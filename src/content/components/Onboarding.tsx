import React, { useState, useEffect } from 'react';

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

export function Onboarding({ initialProfile, onSave, onClose }: OnboardingProps) {
  const [name, setName] = useState(initialProfile?.name || '');
  const [profession, setProfession] = useState(initialProfile?.profession || '');
  const [interests, setInterests] = useState(initialProfile?.interests || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    // Fake small delay for UX
    setTimeout(() => {
      onSave({ name, profession, interests });
      setIsSaving(false);
    }, 300);
  };

  const inputStyle = {
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(0,0,0,0.2)',
    color: '#f2f3f5',
    fontSize: '13px',
    outline: 'none',
    width: '100%',
    fontFamily: '"Inter", system-ui, sans-serif',
  };

  const labelStyle = {
    fontSize: '12px',
    color: '#b5bac1',
    marginBottom: '4px',
    display: 'block',
    fontWeight: '500',
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: '24px',
        justifyContent: 'center',
        position: 'relative',
        background: 'rgba(15, 17, 20, 0.85)',
      }}
    >
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          border: 'none',
          background: 'transparent',
          color: '#b5bac1',
          cursor: 'pointer',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
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

      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#f2f3f5', margin: '0 0 6px' }}>
          Personalize EzyBuddy
        </h2>
        <p style={{ fontSize: '13px', color: '#b5bac1', margin: 0, lineHeight: '1.4' }}>
          Tell me a bit about yourself so I can tailor my explanations and summaries to your exact
          needs.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <label style={labelStyle}>What should I call you?</label>
          <input
            style={inputStyle}
            value={name}
            onInput={(e: any) => setName(e.target.value)}
            placeholder="e.g. Alex"
          />
        </div>
        <div>
          <label style={labelStyle}>What is your profession or role?</label>
          <input
            style={inputStyle}
            value={profession}
            onInput={(e: any) => setProfession(e.target.value)}
            placeholder="e.g. Software Engineer, Student"
          />
        </div>
        <div>
          <label style={labelStyle}>What are your main interests?</label>
          <input
            style={inputStyle}
            value={interests}
            onInput={(e: any) => setInterests(e.target.value)}
            placeholder="e.g. Tech, History, Cooking"
          />
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving}
        style={{
          marginTop: '20px',
          padding: '12px',
          borderRadius: '8px',
          border: 'none',
          background: 'linear-gradient(135deg, #5865f2 0%, #8b5cf6 100%)',
          color: '#fff',
          fontSize: '14px',
          fontWeight: '600',
          cursor: isSaving ? 'wait' : 'pointer',
          boxShadow: '0 4px 14px rgba(88,101,242,0.3)',
          opacity: isSaving ? 0.7 : 1,
          fontFamily: '"Inter", system-ui, sans-serif',
        }}
      >
        {isSaving ? 'Saving...' : initialProfile?.name ? 'Save Profile' : 'Start using EzyBuddy'}
      </button>
    </div>
  );
}
