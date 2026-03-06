class OffscreenDocumentManager {
  private static instance: OffscreenDocumentManager;
  private creatingOffscreen: Promise<void> | null = null;

  static getInstance() {
    if (!OffscreenDocumentManager.instance) {
      OffscreenDocumentManager.instance = new OffscreenDocumentManager();
    }
    return OffscreenDocumentManager.instance;
  }

  private async hasOffscreenDocument(): Promise<boolean> {
    if ('getContexts' in chrome.runtime) {
      const contexts = await chrome.runtime.getContexts({
        contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
      });
      return Boolean(contexts.length);
    }

    // Fallback for older Chrome builds
    try {
      const clients = await (self as any).clients.matchAll();
      return clients.some((c: any) => c.url.includes('offscreen.html'));
    } catch {
      return false;
    }
  }

  async ensure() {
    if (await this.hasOffscreenDocument()) return;

    if (this.creatingOffscreen) {
      await this.creatingOffscreen;
      return;
    }

    this.creatingOffscreen = chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: [chrome.offscreen.Reason.WORKERS],
      justification: 'Running WebLLM local AI model in a sandboxed worker.',
    });

    await this.creatingOffscreen;
    this.creatingOffscreen = null;
  }
}

export const offscreenManager = OffscreenDocumentManager.getInstance();
