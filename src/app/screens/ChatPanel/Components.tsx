import styled from '@emotion/styled';
import { bubbleInKeyframes, dotPulseKeyframes } from '../../components/Animations';

export const ChatPanelWrapper = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

export const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px 11px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(15, 17, 20, 0.85);
`;

export const StatusIndicator = styled.div<{ loaded: boolean }>`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: ${(props) => (props.loaded ? '#23a55a' : '#f87171')};
  box-shadow: ${(props) => (props.loaded ? '0 0 6px rgba(35, 165, 90, 0.7)' : 'none')};
`;

export const IconButton = styled.button`
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

export const QuickActions = styled.div`
  display: flex;
  gap: 6px;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  flex-wrap: wrap;
`;

export const Chip = styled.button`
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

export const MessagesArea = styled.div`
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

export const Bubble = styled.div<{ role: 'user' | 'assistant' }>`
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
  animation: ${bubbleInKeyframes} 0.3s ease-out;

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

export const ProgressBubble = styled.div<{ loaded: boolean }>`
  align-self: ${(props) => (props.loaded ? 'flex-start' : 'center')};
  width: ${(props) => (props.loaded ? 'auto' : '90%')};
  padding: 14px 16px;
  border-radius: ${(props) => (props.loaded ? '14px 14px 14px 4px' : '12px')};
  background: rgba(15, 17, 20, 0.85);
  border: 1px solid rgba(88, 101, 242, 0.2);
  text-align: ${(props) => (props.loaded ? 'left' : 'center')};
  color: #f2f3f5;
  animation: ${bubbleInKeyframes} 0.3s ease-out;
`;

export const Dot = styled.div`
  display: inline-block;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #5865f2;
  margin: 0 2px;
  animation: ${dotPulseKeyframes} 1.3s ease infinite;

  &:nth-of-type(2) {
    animation-delay: 0.18s;
  }
  &:nth-of-type(3) {
    animation-delay: 0.36s;
  }
`;

export const ProgressBar = styled.div`
  width: 100%;
  height: 3px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
  margin: 10px 0 6px;
`;

export const ProgressFill = styled.div<{ progress: number }>`
  width: ${(props) => props.progress}%;
  height: 100%;
  border-radius: 999px;
  background: #5865f2;
  transition: width 0.3s ease;
`;

export const Composer = styled.div`
  display: flex;
  padding: 10px 12px;
  gap: 8px;
  background: rgba(0, 0, 0, 0.35);
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  align-items: center;
`;

export const InputField = styled.input`
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

export const SendButton = styled.button`
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

export const SendIcon = () => {
  return (
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
  );
};
