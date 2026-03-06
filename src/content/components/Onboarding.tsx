import React, { useState } from 'react';
import styled from '@emotion/styled';

export type UserProfile = {
  name: string;
  profession: string;
  interests: string;
};

interface OnboardingProps {
  initialProfile: UserProfile | null;
  onSave: (profile: UserProfile) => void;
  onClose: () => void;
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 24px;
  justify-content: center;
  position: relative;
  background: rgba(15, 17, 20, 0.85);
`;

const CloseButton = styled.button`
  position: absolute;
  top: 12px;
  right: 12px;
  border: none;
  background: transparent;
  color: #b5bac1;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: color 0.2s;

  &:hover {
    color: #f2f3f5;
  }
`;

const Header = styled.div`
  text-align: center;
  margin-bottom: 20px;

  h2 {
    font-size: 18px;
    font-weight: 600;
    color: #f2f3f5;
    margin: 0 0 6px;
  }

  p {
    font-size: 13px;
    color: #b5bac1;
    margin: 0;
    line-height: 1.4;
  }
`;

const Form = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
`;

const Label = styled.label`
  font-size: 12px;
  color: #b5bac1;
  margin-bottom: 4px;
  display: block;
  font-weight: 500;
`;

const Input = styled.input`
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.2);
  color: #f2f3f5;
  font-size: 13px;
  outline: none;
  width: 100%;
  font-family: 'Inter', system-ui, sans-serif;
  transition: border-color 0.2s;

  &:focus {
    border-color: rgba(88, 101, 242, 0.5);
  }

  &::placeholder {
    color: #4f5660;
  }
`;

const SaveButton = styled.button<{ isSaving: boolean }>`
  margin-top: 20px;
  padding: 12px;
  border-radius: 8px;
  border: none;
  background: linear-gradient(135deg, #5865f2 0%, #8b5cf6 100%);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: ${(props) => (props.isSaving ? 'wait' : 'pointer')};
  box-shadow: 0 4px 14px rgba(88, 101, 242, 0.3);
  opacity: ${(props) => (props.isSaving ? 0.7 : 1)};
  font-family: 'Inter', system-ui, sans-serif;
  transition:
    transform 0.2s,
    opacity 0.2s;

  &:hover {
    transform: ${(props) => (props.isSaving ? 'none' : 'translateY(-1px)')};
    box-shadow: 0 6px 20px rgba(88, 101, 242, 0.4);
  }

  &:active {
    transform: translateY(0);
  }
`;

export function Onboarding({ initialProfile, onSave, onClose }: OnboardingProps) {
  const [name, setName] = useState(initialProfile?.name || '');
  const [profession, setProfession] = useState(initialProfile?.profession || '');
  const [interests, setInterests] = useState(initialProfile?.interests || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      onSave({ name, profession, interests });
      setIsSaving(false);
    }, 300);
  };

  return (
    <Container>
      <CloseButton onClick={onClose} title="Close">
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
      </CloseButton>

      <Header>
        <h2>Personalize EzyBuddy</h2>
        <p>
          Tell me a bit about yourself so I can tailor my explanations and summaries to your exact
          needs.
        </p>
      </Header>

      <Form>
        <Field>
          <Label>What should I call you?</Label>
          <Input
            value={name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
            placeholder="Alex"
          />
        </Field>
        <Field>
          <Label>What is your profession or role?</Label>
          <Input
            value={profession}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProfession(e.target.value)}
            placeholder="Software Engineer, Student"
          />
        </Field>
        <Field>
          <Label>What are your main interests?</Label>
          <Input
            value={interests}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInterests(e.target.value)}
            placeholder="Tech, History, Cooking"
          />
        </Field>
      </Form>

      <SaveButton onClick={handleSave} isSaving={isSaving} disabled={isSaving}>
        {isSaving ? 'Saving...' : initialProfile?.name ? 'Save Profile' : 'Start using EzyBuddy'}
      </SaveButton>
    </Container>
  );
}
