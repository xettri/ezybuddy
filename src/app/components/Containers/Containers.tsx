import styled from '@emotion/styled';
import { panelInKeyframes } from '../Animations';

const Z_INDEX = 2147483647;

export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  isOnRight?: boolean;
}

const getPositionMargin = (isOnRight?: boolean) => {
  return isOnRight ? 'right: 20px;' : 'left: 20px;';
};

export const BaseContainer = styled.div<ContainerProps>`
  ${(props) => getPositionMargin(props.isOnRight)}
  position: fixed;
  bottom: 74px;
  width: 350px;
  display: flex;
  flex-direction: column;
  border-radius: 20px;
  background: rgba(15, 17, 20, 0.95);
  backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6);
  overflow: hidden;
  z-index: ${Z_INDEX};
  animation: ${panelInKeyframes} 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  pointer-events: auto;
`;

export const ChatPanelContainer = styled(BaseContainer)`
  height: 80vh;
  max-height: 560px;
`;

export const AppContainer = styled.div<ContainerProps>`
  ${(props) => getPositionMargin(props.isOnRight)}
  position: fixed;
  pointer-events: none;
  z-index: ${Z_INDEX};
  bottom: 20px;
`;

export const ContentContainer = styled.div<{ isOpen: boolean }>`
  display: ${(props) => (props.isOpen ? 'block' : 'none')};
  pointer-events: auto;
`;
