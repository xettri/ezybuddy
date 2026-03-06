import React, { useState, useRef, useEffect } from 'react';
import { marked } from 'marked';
import styled from '@emotion/styled';
import { ChatEntry } from '../../hooks/useChatStream';
import { keyframes } from '@emotion/react';
import moduleStyles from './ChatPanel.module.css';
import rawModuleCSS from './ChatPanel.module.css?inline';

interface ChatPanelProps {
  isOpen: boolean;
  isOnRight: boolean;
  onClose: () => void;
  onClearHistory: () => void;
  onOpenProfile: () => void;

  modelLoaded: boolean;
  modelProgress: number;
  modelStatusText: string;

  chatHistory: ChatEntry[];
  activeRequest: {
    id: string;
    userText: string;
    rawText: string;
    htmlResult: string;
    error: string | null;
  } | null;

  onSend: (text: string, overrideQuery?: string) => void;
  userProfile: { name: string; profession: string; interests: string } | null;
}

const panelIn = keyframes`
  from { opacity: 0; transform: translateY(12px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
`;

const bubbleIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;

const dotPulse = keyframes`
  0%, 100% { transform: scale(0.8); opacity: 0.5; }
  50% { transform: scale(1.1); opacity: 1; }
`;

const PanelContainer = styled.div<{ isOnRight: boolean }>`
  position: fixed;
  bottom: 74px;
  ${(props) => (props.isOnRight ? 'right: 20px;' : 'left: 20px;')}
  width: 350px;
  max-height: 560px;
  height: 80vh;
  display: flex;
  flex-direction: column;
  border-radius: 20px;
  background: rgba(15, 17, 20, 0.95);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow:
    0 30px 80px rgba(0, 0, 0, 0.6),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
  overflow: hidden;
  z-index: 2147483647;
  animation: ${panelIn} 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  pointer-events: auto;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px 11px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(15, 17, 20, 0.85);
`;

const StatusIndicator = styled.div<{ loaded: boolean }>`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: ${(props) => (props.loaded ? '#23a55a' : '#f87171')};
  box-shadow: ${(props) => (props.loaded ? '0 0 6px rgba(35, 165, 90, 0.7)' : 'none')};
`;

const IconButton = styled.button`
  border: none;
  background: transparent;
  color: #b5bac1;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    background 0.2s,
    color 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #f2f3f5;
  }
`;

const QuickActions = styled.div`
  display: flex;
  gap: 6px;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  flex-wrap: wrap;
`;

const Chip = styled.button`
  border: 1px solid rgba(88, 101, 242, 0.25);
  border-radius: 15px;
  padding: 4px 8px;
  font-size: 10px;
  font-weight: 500;
  cursor: pointer;
  background: rgba(88, 101, 242, 0.15);
  color: #b9beff;
  outline: none;
  transition:
    background 0.2s,
    border-color 0.2s;

  &:hover {
    background: rgba(88, 101, 242, 0.25);
    border-color: rgba(88, 101, 242, 0.4);
  }
`;

const MessagesArea = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;

  /* Hide scrollbar but keep functionality */
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.1) transparent;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 10px;
  }
`;

const Bubble = styled.div<{ role: 'user' | 'assistant' }>`
  align-self: ${(props) => (props.role === 'user' ? 'flex-end' : 'flex-start')};
  max-width: 88%;
  padding: 10px 14px;
  border-radius: ${(props) =>
    props.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px'};
  font-size: 13px;
  line-height: 1.55;
  word-break: break-word;
  background: ${(props) =>
    props.role === 'user'
      ? 'linear-gradient(135deg, #5865f2 0%, #8b5cf6 100%)'
      : 'rgba(15, 17, 20, 0.85)'};
  border: ${(props) => (props.role === 'user' ? 'none' : '1px solid rgba(255, 255, 255, 0.12)')};
  color: ${(props) => (props.role === 'user' ? '#fff' : '#f2f3f5')};
  animation: ${bubbleIn} 0.3s ease-out;

  /* Markdown content styling */
  ul,
  ol {
    margin: 8px 0;
    padding-left: 18px;
  }
  li {
    margin-bottom: 4px;
  }
  p:last-child {
    margin-bottom: 0;
  }
`;

const ProgressBubble = styled.div<{ loaded: boolean }>`
  align-self: ${(props) => (props.loaded ? 'flex-start' : 'center')};
  width: ${(props) => (props.loaded ? 'auto' : '90%')};
  padding: 14px 16px;
  border-radius: ${(props) => (props.loaded ? '14px 14px 14px 4px' : '12px')};
  background: rgba(15, 17, 20, 0.85);
  border: 1px solid rgba(88, 101, 242, 0.2);
  text-align: ${(props) => (props.loaded ? 'left' : 'center')};
  color: #f2f3f5;
  animation: ${bubbleIn} 0.3s ease-out;
`;

const Dot = styled.div`
  display: inline-block;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #5865f2;
  margin: 0 2px;
  animation: ${dotPulse} 1.3s ease infinite;

  &:nth-of-type(2) {
    animation-delay: 0.18s;
  }
  &:nth-of-type(3) {
    animation-delay: 0.36s;
  }
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 3px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
  margin: 10px 0 6px;
`;

const ProgressFill = styled.div<{ progress: number }>`
  width: ${(props) => props.progress}%;
  height: 100%;
  border-radius: 999px;
  background: #5865f2;
  transition: width 0.3s ease;
`;

const Composer = styled.div`
  display: flex;
  padding: 10px 12px;
  gap: 8px;
  background: rgba(0, 0, 0, 0.35);
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  align-items: center;
`;

const InputField = styled.input`
  flex: 1;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.2);
  color: #f2f3f5;
  font-size: 13px;
  padding: 8px 12px;
  outline: none;
  transition: border-color 0.2s;

  &:focus {
    border-color: rgba(88, 101, 242, 0.4);
  }
`;

const SendButton = styled.button`
  border: none;
  background: linear-gradient(135deg, #5865f2 0%, #8b5cf6 100%);
  color: #fff;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: transform 0.2s;

  &:hover {
    transform: scale(1.05);
  }
  &:active {
    transform: scale(0.95);
  }
`;

const ChatPanel = (props: ChatPanelProps) => {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [props.chatHistory, props.activeRequest]);

  if (!props.isOpen) return null;

  const handleSend = () => {
    const text = inputValue.trim();
    if (!text) return;
    setInputValue('');
    props.onSend(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  const makeChip = (label: string, query: string) => (
    <Chip key={label} onClick={() => props.onSend(label, query)}>
      {label}
    </Chip>
  );

  const getWhyUsefulChip = () => {
    const display = 'Why is this useful for me?';
    const prof = props.userProfile?.profession;
    const int = props.userProfile?.interests;

    if (!prof && !int) {
      return makeChip(
        display,
        'Explain in 2-3 bullet points why this page might be useful to a general reader.',
      );
    }

    const contextParts = [];
    if (prof) contextParts.push(`a ${prof}`);
    if (int) contextParts.push(`someone interested in ${int}`);

    return makeChip(
      display,
      `Given I am ${contextParts.join(' and ')}, explain exactly why this page is useful to me. 2-3 short, punchy bullet points only. No fluff.`,
    );
  };

  return (
    <PanelContainer isOnRight={props.isOnRight} className={moduleStyles.chatBackground}>
      <style dangerouslySetInnerHTML={{ __html: rawModuleCSS }} />
      <Header>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <StatusIndicator loaded={props.modelLoaded} />
          <span style={{ fontSize: '13.5px', fontWeight: '600', color: '#f2f3f5' }}>EzyBuddy</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          <IconButton title="Settings / Profile" onClick={props.onOpenProfile}>
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </IconButton>
          <IconButton title="Clear history" onClick={props.onClearHistory}>
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4h6v2" />
            </svg>
          </IconButton>
          <IconButton onClick={props.onClose} title="Close">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </IconButton>
        </div>
      </Header>

      <QuickActions>
        {makeChip('Summarize', 'Summarize this page in a few bullet points')}
        {makeChip('Key points', 'List the key points of this page as bullet points')}
        {getWhyUsefulChip()}
      </QuickActions>

      <MessagesArea>
        {props.chatHistory.map((msg, i) => (
          <Bubble key={i} role={msg.role}>
            {msg.role === 'user' ? (
              msg.text
            ) : (
              <div
                className="eb-md"
                dangerouslySetInnerHTML={{ __html: marked.parse(msg.text) as string }}
              />
            )}
          </Bubble>
        ))}

        {props.activeRequest && (
          <>
            <Bubble role="user">{props.activeRequest.userText}</Bubble>

            {props.activeRequest.error || !props.activeRequest.htmlResult ? (
              <ProgressBubble loaded={props.modelLoaded}>
                {props.activeRequest.error ? (
                  `⚠️ ${props.activeRequest.error}`
                ) : props.modelLoaded ? (
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <Dot />
                    <Dot />
                    <Dot />
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '12px', color: '#b5bac1' }}>
                      {props.modelStatusText}
                    </div>
                    <ProgressBar>
                      <ProgressFill progress={props.modelProgress} />
                    </ProgressBar>
                    <div style={{ fontSize: '11px', color: '#5865a0' }}>{props.modelProgress}%</div>
                  </div>
                )}
              </ProgressBubble>
            ) : (
              <Bubble role="assistant">
                <div
                  className="eb-md"
                  dangerouslySetInnerHTML={{ __html: props.activeRequest.htmlResult }}
                />
              </Bubble>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </MessagesArea>

      <Composer>
        <InputField
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about this page…"
        />
        <SendButton onClick={handleSend} title="Send">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </SendButton>
      </Composer>
    </PanelContainer>
  );
};

export default ChatPanel;
