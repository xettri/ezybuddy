import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';

const panelIn = keyframes`
  from { opacity: 0; transform: translateY(12px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
`;

const OnboardingOverlay = styled.div<{ isOnRight: boolean }>`
  ${(props) => (props.isOnRight ? 'right: 20px;' : 'left: 20px;')}
  position: fixed;
  bottom: 74px;
  width: 350px;
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

export default OnboardingOverlay;
