import React, { useState, useRef, useEffect } from 'react';
import styled from '@emotion/styled';
import { marked } from 'marked';
import { ChatEntry } from '../../hooks/useChatStream';
import moduleStyles from './ChatPanel.module.css';
import rawModuleCSS from './ChatPanel.module.css?inline';
import {
  Dot,
  Chip,
  Bubble,
  Header,
  ChatPanelWrapper,
  StatusIndicator,
  IconButton,
  QuickActions,
  MessagesArea,
  ProgressBubble,
  ProgressBar,
  ProgressFill,
  Composer,
  InputField,
  SendButton,
  SendIcon,
} from './Components';

export interface ChatPanelProps {
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
    <ChatPanelWrapper className={moduleStyles.chatBackground}>
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
          <SendIcon />
        </SendButton>
      </Composer>
    </ChatPanelWrapper>
  );
};

export default ChatPanel;
