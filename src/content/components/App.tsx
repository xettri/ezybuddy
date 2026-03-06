import { useState, useEffect } from 'react';
import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';
import { FloatingActionButton } from './FloatingActionButton';
import { ChatPanel } from './ChatPanel';
import { Onboarding, UserProfile } from './Onboarding';
import { GlobalStyles } from './GlobalStyles';
import { useChatStream } from '../hooks/useChatStream';
import { buildPageContext } from '../pageAnalyzer';
import { CacheProvider, EmotionCache } from '@emotion/react';

const panelIn = keyframes`
  from { opacity: 0; transform: translateY(12px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
`;

const AppWrapper = styled.div<{ isOnRight: boolean }>`
  position: fixed;
  pointer-events: none;
  z-index: 2147483647;
  bottom: 20px;
  ${(props) => (props.isOnRight ? 'right: 20px;' : 'left: 20px;')}
  font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
`;

const OnboardingOverlay = styled.div<{ isOnRight: boolean }>`
  position: fixed;
  bottom: 74px;
  ${(props) => (props.isOnRight ? 'right: 20px;' : 'left: 20px;')}
  width: 350px;
  height: 460px;
  display: flex;
  flex-direction: column;
  border-radius: 20px;
  background: rgba(15, 17, 20, 0.95);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6);
  overflow: hidden;
  z-index: 2147483647;
  animation: ${panelIn} 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  pointer-events: auto;
`;

const ContentContainer = styled.div<{ isOpen: boolean }>`
  display: ${(props) => (props.isOpen ? 'block' : 'none')};
  pointer-events: auto;
`;

export function App({ emotionCache }: { emotionCache: EmotionCache }) {
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
    <CacheProvider value={emotionCache}>
      <GlobalStyles />
      <AppWrapper isOnRight={isOnRight}>
        <FloatingActionButton
          isHidden={isHidden}
          isOnRight={isOnRight}
          onToggle={handleTogglePanel}
          onHide={handleHideFab}
          onSnapLeft={() => handleSnapSide(false)}
          onSnapRight={() => handleSnapSide(true)}
        />

        <ContentContainer isOpen={isPanelOpen && !isHidden}>
          {showOnboarding ? (
            <OnboardingOverlay isOnRight={isOnRight}>
              <Onboarding
                initialProfile={userProfile}
                onSave={handleSaveProfile}
                onClose={() => setIsPanelOpen(false)}
              />
            </OnboardingOverlay>
          ) : (
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
          )}
        </ContentContainer>
      </AppWrapper>
    </CacheProvider>
  );
}
