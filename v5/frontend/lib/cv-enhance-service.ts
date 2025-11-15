export interface CVEnhanceResponse {
  suggestions: string[];
  enhanced: string;
}

class CVEnhanceService {
  private readonly HF_ROUTER_TOKEN = (process.env.NEXT_PUBLIC_HF_ROUTER_TOKEN || '').trim();
  private readonly HF_ROUTER_PROVIDER = (process.env.NEXT_PUBLIC_HF_ROUTER_PROVIDER || 'together').trim();
  private readonly HF_ROUTER_MODEL = (process.env.NEXT_PUBLIC_HF_ROUTER_MODEL || 'mistralai/Mixtral-8x7B-Instruct-v0.1').trim();

  private buildRouterUrl(): string {
    return `https://router.huggingface.co/${this.HF_ROUTER_PROVIDER}/v1/chat/completions`;
  }

  async enhance(text: string): Promise<CVEnhanceResponse> {
    if (!this.HF_ROUTER_TOKEN) {
      return this.fallbackEnhance(text);
    }
    const messages = [
      { role: 'system', content: 'You are an expert CV editor. Return compact JSON only with keys: suggestions (array of 5 short actionable items), enhanced (string: improved CV text). Keep tone professional, concise, ATS-friendly.' },
      { role: 'user', content: text },
    ];
    const body = JSON.stringify({ model: this.HF_ROUTER_MODEL, messages, temperature: 0.2, max_tokens: 900 });
    try {
      const res = await fetch(this.buildRouterUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.HF_ROUTER_TOKEN}` },
        body,
      });
      if (!res.ok) {
        return this.fallbackEnhance(text);
      }
      const data = await res.json();
      const content: string = data?.choices?.[0]?.message?.content || '';
      const start = content.indexOf('{');
      const end = content.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        try {
          const parsed = JSON.parse(content.slice(start, end + 1));
          const suggestions = Array.isArray(parsed.suggestions)
            ? parsed.suggestions.map((s: any) => String(s)).slice(0, 8)
            : [];
          const enhanced = typeof parsed.enhanced === 'string' ? parsed.enhanced : '';
          if (suggestions.length || enhanced) {
            return { suggestions, enhanced: enhanced || this.simpleImprove(text) };
          }
        } catch {}
      }
      return this.fallbackEnhance(text);
    } catch {
      return this.fallbackEnhance(text);
    }
  }

  private fallbackEnhance(text: string): CVEnhanceResponse {
    const suggestions: string[] = [];
    const hasMetrics = /\b(\d+%|\d+\+|\$\d+)/.test(text);
    if (!hasMetrics) suggestions.push('Add quantifiable achievements (e.g., Increased efficiency by 20%).');
    if (!/\b(led|managed|built|delivered|improved|implemented|designed)\b/i.test(text)) suggestions.push('Start bullets with impactful action verbs.');
    if (text.split(/\n/).length < 10) suggestions.push('Expand experience with 2–3 bullets per role focusing on outcomes.');
    suggestions.push('Align keywords with target job descriptions for better ATS matching.');
    suggestions.push('Ensure consistent formatting and section headings.');
    const enhanced = this.simpleImprove(text);
    return { suggestions: suggestions.slice(0, 5), enhanced };
  }

  private simpleImprove(text: string): string {
    const lines = text.split('\n');
    return lines
      .map((line) => {
        const t = line.trim();
        if (!t) return line;
        if (/^[-•✓]/.test(t)) return `• ${t.replace(/^[-•✓]\s*/, '')}`;
        return `• ${t}`;
      })
      .join('\n');
  }
}

export const cvEnhanceService = new CVEnhanceService();
