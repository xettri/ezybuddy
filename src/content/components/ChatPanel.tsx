import { useState, useRef, useEffect } from 'react';
import { marked } from 'marked';
import { ChatEntry } from '../hooks/useChatStream';

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

export function ChatPanel(props: ChatPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
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

  const handleKeyDown = (e: any) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  const makeChip = (label: string, query: string) => (
    <button
      onClick={() => props.onSend(label, query)}
      style={{
        border: '1px solid rgba(88,101,242,0.25)',
        borderRadius: '6px',
        padding: '4px 10px',
        fontSize: '11.5px',
        fontWeight: '500',
        cursor: 'pointer',
        background: 'rgba(88,101,242,0.15)',
        color: '#b9beff',
        outline: 'none',
        fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
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
    <div
      style={{
        position: 'fixed',
        bottom: '74px',
        [props.isOnRight ? 'right' : 'left']: '20px',
        width: '350px',
        maxHeight: '560px',
        height: '80vh',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '20px',
        background: 'rgba(15, 17, 20, 0.95)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.15)',
        boxShadow: '0 30px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.15)',
        overflow: 'hidden',
        zIndex: 2147483647,
        animation: 'eb-panel-in 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        pointerEvents: 'auto',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 14px 11px',
          borderBottom: '1px solid rgba(255,255,255,0.12)',
          background: 'rgba(15, 17, 20, 0.85)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: props.modelLoaded ? '#23a55a' : '#f87171',
              boxShadow: props.modelLoaded ? '0 0 6px rgba(35,165,90,0.7)' : 'none',
            }}
          ></div>
          <span style={{ fontSize: '13.5px', fontWeight: '600', color: '#f2f3f5' }}>EzyBuddy</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          <button
            title="Settings / Profile"
            onClick={props.onOpenProfile}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#b5bac1',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
            }}
          >
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
          </button>
          <button
            title="Clear history"
            onClick={props.onClearHistory}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#b5bac1',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
            }}
          >
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
          </button>
          <button
            onClick={props.onClose}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#b5bac1',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
            }}
          >
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
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div
        style={{
          display: 'flex',
          gap: '6px',
          padding: '8px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.12)',
          flexWrap: 'wrap',
        }}
      >
        {makeChip('Summarize', 'Summarize this page in a few bullet points')}
        {makeChip('Key points', 'List the key points of this page as bullet points')}
        {getWhyUsefulChip()}
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {props.chatHistory.map((msg, i) => (
          <div
            key={i}
            className={`eb-bubble-anim ${msg.role === 'assistant' ? 'eb-md' : ''}`}
            style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '88%',
              padding: '10px 14px',
              borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              fontSize: '13px',
              lineHeight: '1.55',
              wordBreak: 'break-word',
              background:
                msg.role === 'user'
                  ? 'linear-gradient(135deg, #5865f2 0%, #8b5cf6 100%)'
                  : 'rgba(15, 17, 20, 0.85)',
              border: msg.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.12)',
              color: msg.role === 'user' ? '#fff' : '#f2f3f5',
            }}
          >
            {msg.role === 'user' ? (
              msg.text
            ) : (
              <div dangerouslySetInnerHTML={{ __html: marked.parse(msg.text) as string }} />
            )}
          </div>
        ))}

        {props.activeRequest && (
          <>
            {/* Active User Message */}
            <div
              className="eb-bubble-anim"
              style={{
                alignSelf: 'flex-end',
                maxWidth: '88%',
                padding: '10px 14px',
                borderRadius: '16px 16px 4px 16px',
                fontSize: '13px',
                lineHeight: '1.55',
                wordBreak: 'break-word',
                background: 'linear-gradient(135deg, #5865f2 0%, #8b5cf6 100%)',
                color: '#fff',
              }}
            >
              {props.activeRequest.userText}
            </div>

            {/* Typing / Progress Indicator or Active AI Response */}
            {props.activeRequest.error || !props.activeRequest.htmlResult ? (
              <div
                className="eb-bubble-anim"
                style={{
                  alignSelf: props.modelLoaded ? 'flex-start' : 'center',
                  width: props.modelLoaded ? 'auto' : '90%',
                  padding: '14px 16px',
                  borderRadius: props.modelLoaded ? '14px 14px 14px 4px' : '12px',
                  background: 'rgba(15, 17, 20, 0.85)',
                  border: '1px solid rgba(88,101,242,0.2)',
                  textAlign: props.modelLoaded ? 'left' : 'center',
                  color: '#f2f3f5',
                }}
              >
                {props.activeRequest.error ? (
                  `⚠️ ${props.activeRequest.error}`
                ) : props.modelLoaded ? (
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div className="eb-dot"></div>
                    <div className="eb-dot"></div>
                    <div className="eb-dot"></div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#b5bac1', marginBottom: '10px' }}>
                      {props.modelStatusText}
                    </div>
                    <div
                      style={{
                        width: '100%',
                        height: '3px',
                        borderRadius: '999px',
                        background: 'rgba(255,255,255,0.06)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${props.modelProgress}%`,
                          height: '100%',
                          borderRadius: '999px',
                          background: '#5865f2',
                          transition: 'width 0.3s ease',
                        }}
                      ></div>
                    </div>
                    <div style={{ fontSize: '11px', color: '#5865a0', marginTop: '6px' }}>
                      {props.modelProgress}%
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div
                className="eb-bubble-anim eb-md"
                style={{
                  alignSelf: 'flex-start',
                  maxWidth: '88%',
                  padding: '10px 14px',
                  borderRadius: '16px 16px 16px 4px',
                  fontSize: '13px',
                  lineHeight: '1.55',
                  wordBreak: 'break-word',
                  background: 'rgba(15, 17, 20, 0.85)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#f2f3f5',
                }}
              >
                <div dangerouslySetInnerHTML={{ __html: props.activeRequest.htmlResult }} />
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div
        style={{
          display: 'flex',
          padding: '10px 12px',
          gap: '8px',
          background: 'rgba(0, 0, 0, 0.35)',
          borderTop: '1px solid rgba(255,255,255,0.12)',
          alignItems: 'center',
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onInput={(e: any) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about this page…"
          style={{
            flex: 1,
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(0,0,0,0.3)',
            color: '#f2f3f5',
            fontSize: '13px',
            padding: '8px 12px',
            outline: 'none',
          }}
        />
        <button
          onClick={handleSend}
          title="Send"
          style={{
            border: 'none',
            background: 'linear-gradient(135deg, #5865f2 0%, #8b5cf6 100%)',
            color: '#fff',
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
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
        </button>
      </div>
    </div>
  );
}
