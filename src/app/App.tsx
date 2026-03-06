import { useState, useEffect } from 'react';
import { Fab, GlobalStyles } from './components';
import { ChatPanel, Onboarding, type UserProfile } from './screens';
import { useChatStream } from './hooks/useChatStream';
import { buildPageContext } from '../analyzer';
import {
  AppContainer,
  ContentContainer,
  BaseContainer,
  ChatPanelContainer,
} from './components/Containers';

const App = () => {
  const [isHidden, setIsHidden] = useState(() => localStorage.getItem('eb_fab_hidden') !== 'false');
  const [isOnRight, setIsOnRight] = useState(() => localStorage.getItem('eb_fab_side') !== 'left');
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const {
    modelLoaded,
    modelProgress,
    modelStatusText,
    chatHistory,
    activeRequest,
    setActiveRequest,
    clearHistory,
  } = useChatStream('eb_hist_' + location.href);

  useEffect(() => {
    chrome.storage.local.get('ezybuddy:userProfile', (data) => {
      const p = data['ezybuddy:userProfile'] as UserProfile;
      if (p && (p.name || p.profession || p.interests)) {
        setUserProfile(p);
      } else {
        setShowOnboarding(true);
      }
    });
  }, []);

  useEffect(() => {
    const listener = (msg: any) => {
      if (msg.type === 'SHOW_CHAT') {
        setIsHidden(false);
        setIsPanelOpen(true);
        localStorage.setItem('eb_fab_hidden', 'false');
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const handleTogglePanel = () => {
    setIsPanelOpen((prev) => !prev);
  };

  const handleHideFab = () => {
    setIsHidden(true);
    setIsPanelOpen(false);
    localStorage.setItem('eb_fab_hidden', 'true');
  };

  const handleSnapSide = (right: boolean) => {
    setIsOnRight(right);
    localStorage.setItem('eb_fab_side', right ? 'right' : 'left');
  };

  const handleSend = async (displayValue: string, queryValue?: string) => {
    const text = queryValue ?? displayValue;
    if (!text || activeRequest) return;

    const requestId = Date.now().toString();
    setActiveRequest({
      id: requestId,
      userText: displayValue,
      rawText: '',
      htmlResult: '',
      error: null,
    });

    try {
      const context = await buildPageContext();
      const payload = {
        mode: 'pageQA',
        query: text,
        pageContext: context,
        requestId,
        history: chatHistory.map((m) => ({ role: m.role, content: m.text })),
        userProfile,
      };
      await chrome.runtime.sendMessage({ type: 'AI_REQUEST', payload });
    } catch (err: any) {
      setActiveRequest((prev) =>
        prev ? { ...prev, error: err.message || 'Error communicating with background' } : null,
      );
    }
  };

  const handleSaveProfile = (profile: UserProfile) => {
    setUserProfile(profile);
    chrome.storage.local.set({ 'ezybuddy:userProfile': profile }, () => {
      setShowOnboarding(false);
    });
  };

  return (
    <>
      <GlobalStyles />
      <AppContainer isOnRight={isOnRight}>
        <Fab
          isHidden={isHidden}
          isOnRight={isOnRight}
          onToggle={handleTogglePanel}
          onHide={handleHideFab}
          onSnapLeft={() => handleSnapSide(false)}
          onSnapRight={() => handleSnapSide(true)}
        />

        <ContentContainer isOpen={isPanelOpen && !isHidden}>
          {showOnboarding ? (
            <BaseContainer isOnRight={isOnRight}>
              <Onboarding
                initialProfile={userProfile}
                onSave={handleSaveProfile}
                onClose={() => setIsPanelOpen(false)}
              />
            </BaseContainer>
          ) : (
            <ChatPanelContainer isOnRight={isOnRight}>
              <ChatPanel
                isOpen={isPanelOpen}
                isOnRight={isOnRight}
                onClose={() => setIsPanelOpen(false)}
                onClearHistory={clearHistory}
                onOpenProfile={() => setShowOnboarding(true)}
                modelLoaded={modelLoaded}
                modelProgress={modelProgress}
                modelStatusText={modelStatusText}
                chatHistory={chatHistory}
                activeRequest={activeRequest}
                onSend={handleSend}
                userProfile={userProfile}
              />
            </ChatPanelContainer>
          )}
        </ContentContainer>
      </AppContainer>
    </>
  );
};

export default App;
