export type UserProfile = {
  name: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
  profession: string;
  interests: string;
};

const STORAGE_KEY = 'ezybuddy:userProfile';

function getInput(id: string): HTMLInputElement {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLInputElement)) {
    throw new Error(`Missing input ${id}`);
  }
  return el;
}

function getTextarea(id: string): HTMLTextAreaElement {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLTextAreaElement)) {
    throw new Error(`Missing textarea ${id}`);
  }
  return el;
}

function getStatus(): HTMLDivElement {
  const el = document.getElementById('eb-status');
  if (!(el instanceof HTMLDivElement)) {
    throw new Error('Missing status element');
  }
  return el;
}

async function loadProfile() {
  const name = getInput('eb-name');
  const email = getInput('eb-email');
  const phone = getInput('eb-phone');
  const location = getInput('eb-location');
  const summary = getTextarea('eb-summary');

  chrome.storage.local.get(STORAGE_KEY, (data) => {
    const profile = (data?.[STORAGE_KEY] ?? {}) as Partial<UserProfile>;
    name.value = profile.name ?? '';
    email.value = profile.email ?? '';
    phone.value = profile.phone ?? '';
    location.value = profile.location ?? '';
    summary.value = profile.summary ?? '';
  });
}

async function saveProfile() {
  const status = getStatus();
  status.textContent = '';

  const profile: UserProfile = {
    name: getInput('eb-name').value.trim(),
    email: getInput('eb-email').value.trim(),
    phone: getInput('eb-phone').value.trim(),
    location: getInput('eb-location').value.trim(),
    summary: getTextarea('eb-summary').value.trim(),
    profession: (document.getElementById('eb-profession') as HTMLInputElement)?.value?.trim() ?? '',
    interests: (document.getElementById('eb-interests') as HTMLInputElement)?.value?.trim() ?? '',
  };

  chrome.storage.local.set({ [STORAGE_KEY]: profile }, () => {
    status.textContent = 'Profile saved!';
    setTimeout(() => {
      status.textContent = '';
    }, 3000);
  });
}

function main() {
  const saveBtn = document.getElementById('eb-save');
  if (saveBtn instanceof HTMLButtonElement) {
    saveBtn.addEventListener('click', () => {
      void saveProfile();
    });
  }

  void loadProfile();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
