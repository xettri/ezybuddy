import React, { useState, useEffect, Fragment } from 'react';
import { FloatingActionButton } from './FloatingActionButton';
import { ChatPanel } from './ChatPanel';
import { Onboarding, UserProfile } from './Onboarding';
import { useChatStream } from '../hooks/useChatStream';
import { buildPageContext } from '../pageAnalyzer';

export function App() {
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

  // Load Profile
  useEffect(() => {
    chrome.storage.local.get('ezybuddy:userProfile', (data) => {
      console.log('Data: ', data);
      const p = data['ezybuddy:userProfile'] as UserProfile;
      if (p && (p.name || p.profession || p.interests)) {
        setUserProfile(p);
      } else {
        setShowOnboarding(true);
      }
    });
  }, []);

  // Listen for extension icon click
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
    <div
      style={{
        position: 'fixed',
        pointerEvents: 'none',
        zIndex: 2147483647,
        bottom: '20px',
        [isOnRight ? 'right' : 'left']: '20px',
        fontFamily: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <FloatingActionButton
        isHidden={isHidden}
        isOnRight={isOnRight}
        onToggle={handleTogglePanel}
        onHide={handleHideFab}
        onSnapLeft={() => handleSnapSide(false)}
        onSnapRight={() => handleSnapSide(true)}
      />

      {/* Main chat UI container */}
      <div
        style={{
          display: isPanelOpen && !isHidden ? 'block' : 'none',
          pointerEvents: 'auto',
        }}
      >
        {showOnboarding ? (
          <div
            style={{
              position: 'fixed',
              bottom: '74px',
              [isOnRight ? 'right' : 'left']: '20px',
              width: '350px',
              height: '460px',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: '20px',
              background: 'rgba(15, 17, 20, 0.95)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid rgba(255,255,255,0.15)',
              boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
              overflow: 'hidden',
              zIndex: 2147483647,
              animation: 'eb-panel-in 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <Onboarding
              initialProfile={userProfile}
              onSave={handleSaveProfile}
              onClose={() => setIsPanelOpen(false)}
            />
          </div>
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
      </div>
    </div>
  );
}
