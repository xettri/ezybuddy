import { useRef, useState } from 'react';
import styled from '@emotion/styled';

export interface FABProps {
  isHidden: boolean;
  isOnRight: boolean;
  onToggle: () => void;
  onHide: () => void;
  onSnapLeft: () => void;
  onSnapRight: () => void;
}

const StyledFab = styled.button<{ isHovered: boolean; isDragging: boolean }>`
  width: 48px;
  height: 48px;
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: ${(props) =>
    props.isHovered
      ? 'linear-gradient(135deg, #5865f2 0%, #8b5cf6 100%)'
      : 'rgba(15, 17, 20, 0.95)'};
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: ${(props) => (props.isDragging ? 'grabbing' : 'grab')};
  box-shadow: ${(props) =>
    props.isHovered
      ? '0 12px 40px rgba(88, 101, 242, 0.4), inset 0 0 0 1px rgba(255, 255, 255, 0.2)'
      : '0 8px 32px rgba(88, 101, 242, 0.25), inset 0 0 0 1px rgba(255, 255, 255, 0.05)'};
  transition:
    transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275),
    box-shadow 0.3s,
    background 0.3s;
  touch-action: none;
  outline: none;
  transform: ${(props) => (props.isHovered ? 'scale(1.05)' : 'scale(1)')};
  pointer-events: auto;

  &:active {
    transform: scale(0.95);
  }
`;

const Fab = ({ isHidden, onToggle, onHide, onSnapLeft, onSnapRight }: FABProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isDraggingState, setIsDraggingState] = useState(false);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const hasMoved = useRef(false);
  const lastClickTime = useRef(0);

  if (isHidden) return null;

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    isDragging.current = true;
    setIsDraggingState(true);
    hasMoved.current = false;
    startX.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDragging.current) return;
    if (Math.abs(e.clientX - startX.current) > 6) hasMoved.current = true;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    setIsDraggingState(false);

    if (hasMoved.current) {
      if (e.clientX < window.innerWidth / 2) onSnapLeft();
      else onSnapRight();
    }
  };

  const handleClick = () => {
    if (hasMoved.current) {
      hasMoved.current = false;
      return;
    }
    const now = Date.now();
    if (now - lastClickTime.current < 350) {
      onHide();
      lastClickTime.current = 0;
      return;
    }
    lastClickTime.current = now;
    onToggle();
  };

  return (
    <StyledFab
      title="EzyBuddy (double-click to hide)"
      isHovered={isHovered}
      isDragging={isDraggingState}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={handleClick}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    </StyledFab>
  );
};

export default Fab;
