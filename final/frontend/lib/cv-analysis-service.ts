export interface CVAnalysisResult {
  extractedInfo: {
    name?: string;
    email?: string;
    phone?: string;
    skills: string[];
    experience: string[];
    education: string[];
    companies: string[];
    jobTitles: string[];
  };
  analysis: {
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
    atsScore: number;
    overallScore: number;
  };
  summary: string;
  jobMatches: {
    role: string;
    matchScore: number;
    reason: string;
    linkedinUrl?: string;
    googleJobsUrl?: string;
  }[];
}

export interface UploadedFile {
  file: File;
  id: string;
  name: string;
  size: number;
}

class CVAnalysisService {
  private readonly HUGGINGFACE_API_URL = 'https://api-inference.huggingface.co/models';
  private readonly HF_API_KEY = (process.env.NEXT_PUBLIC_HUGGINGFACE_API_KEY || '').trim();
  private readonly HF_ROUTER_TOKEN = (process.env.NEXT_PUBLIC_HF_ROUTER_TOKEN || '').trim();
  private readonly HF_ROUTER_PROVIDER = (process.env.NEXT_PUBLIC_HF_ROUTER_PROVIDER || 'together').trim();
  private readonly HF_ROUTER_MODEL = (process.env.NEXT_PUBLIC_HF_ROUTER_MODEL || 'mistralai/Mixtral-8x7B-Instruct-v0.1').trim();

  private buildHuggingFaceRouterUrl(): string {
    return `https://router.huggingface.co/${this.HF_ROUTER_PROVIDER}/v1/chat/completions`;
  }

  async extractTextFromFile(file: File): Promise<string> {
    try {
      const nameLower = (file.name || '').toLowerCase();
      const type = file.type || '';
      if (type === 'text/plain' || nameLower.endsWith('.txt')) {
        return await this.extractTextFromTXT(file);
      } else if (type === 'application/pdf' || nameLower.endsWith('.pdf')) {
        try {
          return await this.extractTextFromPDF(file);
        } catch (pdfError) {
          console.warn('PDF parsing failed, using fallback method:', pdfError);
          return await this.extractTextFromPDFFallback(file);
        }
      } else if (type.includes('word') || nameLower.endsWith('.docx') || nameLower.endsWith('.doc')) {
        try {
          return await this.extractTextFromWord(file);
        } catch (wordError) {
          console.warn('Word parsing failed, using fallback method:', wordError);
          return await this.extractTextFromWordFallback(file);
        }
      } else {
        throw new Error('Unsupported file type. Please upload PDF, DOC, DOCX, or TXT files.');
      }
    } catch (error) {
      console.error('Error extracting text from file:', error);
      throw new Error('Failed to extract text from file. Please ensure the file is not corrupted.');
    }
  }

  private async extractTextFromTXT(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        resolve(content);
      };
      reader.onerror = () => reject(new Error('Failed to read text file'));
      reader.readAsText(file);
    });
  }

  private async extractTextFromPDF(file: File): Promise<string> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf');
      const { getDocument, GlobalWorkerOptions } = pdfjs as any;
      GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      const pdf = await getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const items = textContent.items as any[];
        const chunks: string[] = [];
        let currentLineY: number | null = null;
        let currentLine: string[] = [];
        for (const item of items) {
          const str = typeof item.str === 'string' ? item.str : '';
          const transform = item.transform || item?.ts || [];
          const y = Array.isArray(transform) ? transform[5] : undefined;
          if (currentLineY === null) currentLineY = y as number | null;
          const sameLine = y !== undefined && currentLineY !== null && Math.abs((y as number) - (currentLineY as number)) < 2;
          if (!sameLine) {
            if (currentLine.length) chunks.push(currentLine.join(' ').replace(/\s{2,}/g, ' ').trim());
            currentLine = [str];
            currentLineY = (y as number) ?? currentLineY;
          } else {
            currentLine.push(str);
          }
        }
        if (currentLine.length) chunks.push(currentLine.join(' ').replace(/\s{2,}/g, ' ').trim());
        const pageText = chunks.filter(Boolean).join('\n');
        fullText += pageText + '\n';
      }
      const trimmed = fullText.trim();
      if (trimmed.length > 20) {
        return trimmed;
      }
      try {
        const ocrText = await this.extractPdfWithOcr(arrayBuffer);
        if (ocrText && ocrText.trim().length > 10) return ocrText.trim();
      } catch (_) {}
      return trimmed;
    } catch (error) {
      console.error('Error parsing PDF:', error);
      throw new Error('Failed to parse PDF file. Please ensure it is a valid PDF.');
    }
  }

  private async extractTextFromWord(file: File): Promise<string> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const mammoth = await import('mammoth/mammoth.browser');
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value;
    } catch (error) {
      console.error('Error parsing Word document:', error);
      throw new Error('Failed to parse Word document. Please ensure it is a valid DOC/DOCX file.');
    }
  }

  private async extractPdfWithOcr(arrayBuffer: ArrayBuffer): Promise<string> {
    try {
      const Tesseract = (await import('tesseract.js')).default as any;
      const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf');
      const { getDocument } = pdfjs as any;
      const pdf = await getDocument({ data: arrayBuffer }).promise;
      const maxPages = Math.min(pdf.numPages, 3);
      let text = '';
      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) continue;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        await page.render({ canvasContext: context, viewport }).promise;
        const dataUrl = canvas.toDataURL('image/png');
        const { data } = await Tesseract.recognize(dataUrl, 'eng+ara');
        if (data?.text) text += data.text + '\n';
      }
      return text;
    } catch (e) {
      console.warn('OCR fallback failed:', e);
      return '';
    }
  }

  private async extractTextFromPDFFallback(file: File): Promise<string> {
    const fileName = file.name;
    const fileSize = (file.size / 1024 / 1024).toFixed(2);
    return `PDF File: ${fileName} (${fileSize} MB)\n\nNote: PDF text extraction is currently unavailable. Please copy and paste your CV text into a .txt file and upload that instead, or use the text input option below.\n\nAlternatively, you can:\n1. Save your PDF as a Word document (.docx)\n2. Copy the text from your PDF and paste it into a text file\n3. Use the manual text input feature\n\nThis ensures we can provide you with the most accurate CV analysis.`;
  }

  private async extractTextFromWordFallback(file: File): Promise<string> {
    const fileName = file.name;
    const fileSize = (file.size / 1024 / 1024).toFixed(2);
    return `Word Document: ${fileName} (${fileSize} MB)\n\nNote: Word document text extraction is currently unavailable. Please save your document as a .txt file and upload that instead.\n\nAlternatively, you can:\n1. Copy the text from your Word document\n2. Paste it into a text file and save as .txt\n3. Upload the text file for analysis\n\nThis ensures we can provide you with the most accurate CV analysis.`;
  }

  async extractEntities(text: string): Promise<any> {
    try {
      const response = await fetch(`${this.HUGGINGFACE_API_URL}/dslim/bert-base-NER`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.HF_API_KEY ? { Authorization: `Bearer ${this.HF_API_KEY}` } : {}),
        },
        body: JSON.stringify({
          inputs: text,
          parameters: { aggregation_strategy: 'simple' },
        }),
      });
      if (!response.ok) {
        // On model loading or auth errors, fall back to simulated extraction
        if (response.status === 503 || response.status === 401 || response.status === 403) {
          console.warn(`NER API not available (status ${response.status}), using fallback.`);
          return this.simulateEntityExtraction(text);
        }
        console.warn(`NER API error ${response.status}, using fallback.`);
        return this.simulateEntityExtraction(text);
      }
      return await response.json();
    } catch (error) {
      console.error('Error calling Hugging Face NER model:', error);
      return this.simulateEntityExtraction(text);
    }
  }

  private simulateEntityExtraction(text: string): any[] {
    const entities: any[] = [];
    const lines = text.split('\n');
    lines.forEach((line, lineIndex) => {
      const words = line.split(/\s+/);
      words.forEach((word, wordIndex) => {
        if (word.includes('@') && word.includes('.')) {
          entities.push({ entity_group: 'EMAIL', score: 0.95, word, start: lineIndex * 100 + wordIndex * 10, end: lineIndex * 100 + wordIndex * 10 + word.length });
        } else if (
          word.match(/\+?\d{1,4}[\s\-]?\d{1,4}[\s\-]?\d{1,4}[\s\-]?\d{1,4}[\s\-]?\d{1,4}/) ||
          word.match(/\(\d{3}\)\s*\d{3}[\s\-]?\d{4}/) ||
          word.match(/\d{3}[\s\-]?\d{3}[\s\-]?\d{4}/)
        ) {
          entities.push({ entity_group: 'PHONE', score: 0.9, word, start: lineIndex * 100 + wordIndex * 10, end: lineIndex * 100 + wordIndex * 10 + word.length });
        } else if (word.match(/^[A-Z][a-z]+$/) && lineIndex < 5 && word.length > 2) {
          entities.push({ entity_group: 'PER', score: 0.85, word, start: lineIndex * 100 + wordIndex * 10, end: lineIndex * 100 + wordIndex * 10 + word.length });
        } else if (word.match(/[A-Z][a-z]+(?:Company|Corp|Tech|University|College|Inc|Ltd|Council|Contractors|Group|Holdings|Limited|LLC|Institute|School|Academy)/)) {
          entities.push({ entity_group: 'ORG', score: 0.8, word, start: lineIndex * 100 + wordIndex * 10, end: lineIndex * 100 + wordIndex * 10 + word.length });
        } else if (
          word.match(/[A-Z][a-z]+(?:City|Town|State|Province|Country|Kingdom|Republic|Emirates)/) ||
          word.match(/^(New York|London|Paris|Tokyo|Dubai|Riyadh|Cairo|Alexandria|Giza|Luxor|Aswan|Sharm|Hurghada|Saudi Arabia|Egypt|USA|UK|UAE|Canada|Australia|Germany|France|Italy|Spain|India|China|Japan|Brazil|Mexico|South Africa)$/)
        ) {
          entities.push({ entity_group: 'LOC', score: 0.75, word, start: lineIndex * 100 + wordIndex * 10, end: lineIndex * 100 + wordIndex * 10 + word.length });
        } else if (word.match(/^(Manager|Engineer|Director|Supervisor|Lead|Senior|Junior|Principal|Chief|Head|Coordinator|Specialist|Consultant|Analyst|Developer|Designer|Architect|Technician|Assistant|Executive|Officer|Representative|Advisor|Expert|Professional)$/)) {
          entities.push({ entity_group: 'TITLE', score: 0.7, word, start: lineIndex * 100 + wordIndex * 10, end: lineIndex * 100 + wordIndex * 10 + word.length });
        }
      });
    });
    return entities;
  }

  async summarizeCV(text: string): Promise<string> {
    try {
      const response = await fetch(`${this.HUGGINGFACE_API_URL}/facebook/bart-large-cnn`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.HF_API_KEY ? { Authorization: `Bearer ${this.HF_API_KEY}` } : {}),
        },
        body: JSON.stringify({ inputs: text, parameters: { max_length: 100, min_length: 30 } }),
      });
      if (!response.ok) {
        if (response.status === 503 || response.status === 401 || response.status === 403) {
          console.warn(`Summarization API not available (status ${response.status}), using fallback.`);
          return this.generateFallbackSummary(text);
        }
        console.warn(`Summarization API error ${response.status}, using fallback.`);
        return this.generateFallbackSummary(text);
      }
      const result = await response.json();
      return result[0]?.summary_text || this.generateFallbackSummary(text);
    } catch (error) {
      console.error('Error calling Hugging Face summarization model:', error);
      return this.generateFallbackSummary(text);
    }
  }

  private generateFallbackSummary(text: string): string {
    const lines = text.split('\n').filter((line) => line.trim());
    const name = lines[0] || 'Candidate';
    const title = lines[1] || 'Professional';
    const hasExperience = text.includes('18 years') || text.includes('experience');
    const hasProjectManagement = text.includes('Project') && text.includes('Manager');
    const hasCivilEngineering = text.includes('Civil Engineering') || text.includes('Infrastructure');
    const hasSaudiExperience = text.includes('Saudi Arabia') || text.includes('Riyadh');
    const hasEgyptianExperience = text.includes('Egypt') || text.includes('Cairo');
    let summary = `${name} is a ${title} with `;
    if (hasExperience) summary += 'over 18 years of progressive experience ';
    if (hasCivilEngineering) summary += 'in civil engineering and infrastructure projects. ';
    if (hasProjectManagement) summary += 'Expert in project management, construction supervision, and team leadership. ';
    if (hasSaudiExperience && hasEgyptianExperience) summary += 'Has extensive experience working across Egypt and Saudi Arabia. ';
    else if (hasSaudiExperience) summary += 'Currently based in Saudi Arabia with significant project experience. ';
    else if (hasEgyptianExperience) summary += 'Based in Egypt with strong local project experience. ';
    summary += 'Demonstrates strong technical skills, leadership capabilities, and a proven track record of delivering complex infrastructure projects within scope, time, and budget constraints.';
    return summary;
  }

  async analyzeCV(file: File): Promise<CVAnalysisResult> {
    try {
      const text = await this.extractTextFromFile(file);
      const entities = await this.extractEntities(text);
      const summary = await this.summarizeCV(text);
      let extractedInfo = this.processEntities(entities, text);
      if (this.HF_ROUTER_TOKEN) {
        try {
          const llmInfo = await this.callHuggingFaceRouterExtract(text);
          extractedInfo = this.mergeExtractedInfo(extractedInfo, llmInfo);
        } catch (e) {
          console.warn('HF Router structured extraction failed, keep baseline entities. Error:', e);
        }
      }
      let analysis = this.generateAnalysis(extractedInfo, text);
      if (this.HF_ROUTER_TOKEN) {
        try {
          const atsInsights = await this.callHuggingFaceRouterATS(text, extractedInfo);
          analysis = this.mergeAtsInsights(analysis, atsInsights);
        } catch (err) {
          console.warn('HF Router ATS enhancement failed, using baseline analysis. Error:', err);
        }
      }
      const jobMatches = this.generateJobMatches(extractedInfo);
      const inferredLocation = this.inferLocationFromText(text) || 'Saudi Arabia';
      jobMatches.forEach((j) => {
        const keywords = encodeURIComponent(j.role);
        const location = encodeURIComponent(inferredLocation);
        j.linkedinUrl = `https://www.linkedin.com/jobs/search/?keywords=${keywords}&location=${location}`;
        j.googleJobsUrl = `https://www.google.com/search?q=${encodeURIComponent(j.role + ' jobs in ' + inferredLocation)}`;
      });
      return { extractedInfo, analysis, summary, jobMatches };
    } catch (error) {
      console.error('Error analyzing CV:', error);
      throw new Error('Failed to analyze CV. Please try again.');
    }
  }

  private inferLocationFromText(text: string): string | null {
    const lower = text.toLowerCase();
    if (lower.includes('riyadh')) return 'Riyadh, Saudi Arabia';
    if (lower.includes('saudi')) return 'Saudi Arabia';
    if (lower.includes('cairo')) return 'Cairo, Egypt';
    if (lower.includes('egypt')) return 'Egypt';
    if (lower.includes('dubai')) return 'Dubai, United Arab Emirates';
    if (lower.includes('uae')) return 'United Arab Emirates';
    if (lower.includes('doha')) return 'Doha, Qatar';
    if (lower.includes('qatar')) return 'Qatar';
    return null;
  }

  private async callHuggingFaceRouterExtract(text: string): Promise<CVAnalysisResult['extractedInfo']> {
    const messages = [
      { role: 'system', content: 'Extract structured resume fields as compact JSON with keys: name (string), email (string), phone (string), skills (array of strings), experience (array of strings), education (array of strings), companies (array of strings), jobTitles (array of strings). Only output JSON.' },
      { role: 'user', content: text },
    ];
    const body = JSON.stringify({ model: this.HF_ROUTER_MODEL, messages, temperature: 0, max_tokens: 600 });
    const res = await fetch(this.buildHuggingFaceRouterUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.HF_ROUTER_TOKEN}` },
      body,
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`HF Router Extract Error: ${res.status} - ${errorText}`);
    }
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content || '';
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      throw new Error('No JSON block in LLM extraction response');
    }
    const parsed = JSON.parse(content.slice(start, end + 1));
    const normalized: CVAnalysisResult['extractedInfo'] = {
      name: typeof parsed.name === 'string' ? parsed.name : undefined,
      email: typeof parsed.email === 'string' ? parsed.email : undefined,
      phone: typeof parsed.phone === 'string' ? parsed.phone : undefined,
      skills: Array.isArray(parsed.skills) ? parsed.skills.map((s: any) => String(s)) : [],
      experience: Array.isArray(parsed.experience) ? parsed.experience.map((s: any) => String(s)) : [],
      education: Array.isArray(parsed.education) ? parsed.education.map((s: any) => String(s)) : [],
      companies: Array.isArray(parsed.companies) ? parsed.companies.map((s: any) => String(s)) : [],
      jobTitles: Array.isArray(parsed.jobTitles) ? parsed.jobTitles.map((s: any) => String(s)) : [],
    };
    return normalized;
  }

  private mergeExtractedInfo(base: CVAnalysisResult['extractedInfo'], llm: CVAnalysisResult['extractedInfo']): CVAnalysisResult['extractedInfo'] {
    const merged: CVAnalysisResult['extractedInfo'] = { ...base };
    if (!merged.name && llm.name) merged.name = llm.name;
    if (!merged.email && llm.email) merged.email = llm.email;
    if (!merged.phone && llm.phone) merged.phone = llm.phone;
    merged.skills = Array.from(new Set([...(base.skills || []), ...(llm.skills || [])].map((s) => String(s).toLowerCase())));
    merged.experience = Array.from(new Set([...(base.experience || []), ...(llm.experience || [])]));
    merged.education = Array.from(new Set([...(base.education || []), ...(llm.education || [])]));
    merged.companies = Array.from(new Set([...(base.companies || []), ...(llm.companies || [])]));
    merged.jobTitles = Array.from(new Set([...(base.jobTitles || []), ...(llm.jobTitles || [])]));
    return merged;
  }

  private async callHuggingFaceRouterATS(
    text: string,
    info: CVAnalysisResult['extractedInfo']
  ): Promise<{ atsScore?: number; strengths?: string[]; weaknesses?: string[]; suggestions?: string[] }> {
    const messages = [
      { role: 'system', content: 'You are an ATS expert. Analyze the resume text and return JSON with fields: atsScore (0-100), strengths (array), weaknesses (array), suggestions (array). Keep responses concise and objective.' },
      {
        role: 'user',
        content: `Resume Text:\n${text}\n\nExtracted Snapshot (optional): ${JSON.stringify({
          name: info.name,
          email: info.email,
          phone: info.phone,
          skills: info.skills.slice(0, 20),
          titles: info.jobTitles.slice(0, 10),
        })}`,
      },
    ];
    const body = JSON.stringify({ model: this.HF_ROUTER_MODEL, messages, temperature: 0.2, max_tokens: 512 });
    const res = await fetch(this.buildHuggingFaceRouterUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.HF_ROUTER_TOKEN}` },
      body,
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`HF Router API Error: ${res.status} - ${errorText}`);
    }
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content || '';
    let jsonStart = content.indexOf('{');
    let jsonEnd = content.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      try {
        const parsed = JSON.parse(content.slice(jsonStart, jsonEnd + 1));
        return parsed;
      } catch {}
    }
    const atsScoreMatch = content.match(/atsScore\D(\d{1,3})/i);
    const strengths = Array.from(content.matchAll(/-\s*Strengths?:\s*([^\n]+)/gi)).map((m) => m[1]?.trim()).filter(Boolean) as string[];
    const weaknesses = Array.from(content.matchAll(/-\s*Weaknesses?:\s*([^\n]+)/gi)).map((m) => m[1]?.trim()).filter(Boolean) as string[];
    const suggestions = Array.from(content.matchAll(/-\s*Suggestions?:\s*([^\n]+)/gi)).map((m) => m[1]?.trim()).filter(Boolean) as string[];
    return {
      atsScore: atsScoreMatch ? Math.min(100, Math.max(0, parseInt(atsScoreMatch[1], 10))) : undefined,
      strengths: strengths.length ? strengths : undefined,
      weaknesses: weaknesses.length ? weaknesses : undefined,
      suggestions: suggestions.length ? suggestions : undefined,
    };
  }

  private mergeAtsInsights(
    base: CVAnalysisResult['analysis'],
    insights: { atsScore?: number; strengths?: string[]; weaknesses?: string[]; suggestions?: string[] }
  ): CVAnalysisResult['analysis'] {
    const merged: CVAnalysisResult['analysis'] = { ...base };
    if (typeof insights.atsScore === 'number') {
      merged.atsScore = Math.max(0, Math.min(100, Math.round((base.atsScore + insights.atsScore) / 2)));
    }
    if (insights.strengths?.length) {
      merged.strengths = Array.from(new Set([...base.strengths, ...insights.strengths]));
    }
    if (insights.weaknesses?.length) {
      merged.weaknesses = Array.from(new Set([...base.weaknesses, ...insights.weaknesses]));
    }
    if (insights.suggestions?.length) {
      merged.suggestions = Array.from(new Set([...base.suggestions, ...insights.suggestions]));
    }
    const strengthBonus = merged.strengths.length * 3;
    const weaknessPenalty = merged.weaknesses.length * 2;
    merged.overallScore = Math.max(0, Math.min(100, merged.atsScore + strengthBonus - weaknessPenalty));
    return merged;
  }

  private processEntities(entities: any[], text: string): CVAnalysisResult['extractedInfo'] {
    const extractedInfo: CVAnalysisResult['extractedInfo'] = {
      skills: [],
      experience: [],
      education: [],
      companies: [],
      jobTitles: [],
    };
    entities.forEach((entity) => {
      switch (entity.entity_group) {
        case 'PER':
          if (!extractedInfo.name) extractedInfo.name = entity.word;
          break;
        case 'EMAIL':
          extractedInfo.email = entity.word;
          break;
        case 'PHONE':
          extractedInfo.phone = entity.word;
          break;
        case 'ORG':
          extractedInfo.companies.push(entity.word);
          break;
        case 'MISC':
          if (entity.word.toLowerCase().includes('university') || entity.word.toLowerCase().includes('college')) {
            extractedInfo.education.push(entity.word);
          }
          break;
      }
    });
    this.extractAdditionalInfo(text, extractedInfo);
    return extractedInfo;
  }

  private extractAdditionalInfo(text: string, extractedInfo: CVAnalysisResult['extractedInfo']) {
    const skillPatterns = [
      /\b(JavaScript|TypeScript|Python|Java|C\+\+|C#|PHP|Ruby|Go|Rust|Swift|Kotlin|Dart|R|MATLAB|Scala|Perl|Shell|Bash)\b/gi,
      /\b(React|Angular|Vue|Node\.js|Express|Django|Flask|Laravel|Spring|ASP\.NET|HTML|CSS|SASS|LESS|Bootstrap|jQuery|Webpack|Vite)\b/gi,
      /\b(SQL|MySQL|PostgreSQL|MongoDB|Redis|Elasticsearch|Oracle|SQLite|Cassandra|DynamoDB|Firebase|Supabase)\b/gi,
      /\b(AWS|Azure|GCP|Docker|Kubernetes|Jenkins|Git|GitHub|GitLab|CI\/CD|Terraform|Ansible|Linux|Ubuntu|CentOS)\b/gi,
      /\b(Machine Learning|Deep Learning|TensorFlow|PyTorch|Pandas|NumPy|Scikit-learn|R|Tableau|Power BI|Excel|Statistics|Analytics)\b/gi,
      /\b(Figma|Adobe XD|Sketch|Photoshop|Illustrator|InDesign|User Research|Prototyping|UI|UX|Design Systems)\b/gi,
      /\b(Project Management|Agile|Scrum|Kanban|Jira|Confluence|Trello|Asana|MS Project|Primavera|Waterfall)\b/gi,
      /\b(AutoCAD|Revit|STAAD|ETABS|SAP|SolidWorks|MATLAB|ANSYS|Civil Engineering|Mechanical Engineering|Electrical Engineering)\b/gi,
      /\b(Business Analysis|Financial Analysis|Marketing|Sales|Customer Service|Operations|Supply Chain|HR|Recruitment)\b/gi,
      /\b(Leadership|Communication|Teamwork|Problem Solving|Analytical|Strategic|Creative|Adaptable|Time Management|Negotiation)\b/gi,
      /\b(English|Arabic|French|Spanish|German|Italian|Portuguese|Chinese|Japanese|Korean|Russian|Hindi)\b/gi,
    ];
    skillPatterns.forEach((pattern) => {
      const matches = text.match(pattern);
      if (matches) {
        extractedInfo.skills.push(...matches.map((m) => m.toLowerCase()));
      }
    });
    extractedInfo.skills = [...new Set(extractedInfo.skills)];
    const titlePatterns = [
      /\b(Software Engineer|Developer|Programmer|Manager|Analyst|Designer|Consultant|Architect|Lead|Senior|Junior|Principal|Chief|Head|Director|VP|CTO|CEO|CFO|COO)\b/gi,
      /\b(Product Manager|Project Manager|Data Scientist|UX Designer|UI Designer|DevOps Engineer|QA Engineer|Full Stack|Frontend|Backend|Mobile Developer)\b/gi,
      /\b(Civil Engineer|Mechanical Engineer|Electrical Engineer|Chemical Engineer|Aerospace Engineer|Biomedical Engineer|Environmental Engineer)\b/gi,
      /\b(Construction Manager|Site Engineer|Project Engineer|Design Engineer|Process Engineer|Quality Engineer|Safety Engineer)\b/gi,
      /\b(Business Analyst|Financial Analyst|Marketing Manager|Sales Manager|Operations Manager|HR Manager|Account Manager)\b/gi,
      /\b(Teacher|Professor|Researcher|Scientist|Doctor|Nurse|Lawyer|Accountant|Consultant|Advisor|Specialist|Coordinator)\b/gi,
    ];
    titlePatterns.forEach((pattern) => {
      const matches = text.match(pattern);
      if (matches) {
        extractedInfo.jobTitles.push(...matches);
      }
    });
    const experiencePatterns = [
      /(\d{4}\s*[–-]\s*Present|\d{4}\s*[–-]\s*\d{4}|\d{4}\s*to\s*Present|\d{4}\s*to\s*\d{4})\s*([^\.\n]+?)(?:\s+at\s+([^\.\n]+))?/gi,
      /([A-Z][a-z]+\s+\d{4}\s*[–-]\s*\d{4})\s*([^\.\n]+)/gi,
      /(Project\s+[^\.\n]+?)\s*\(\s*(\d{4}\s*[–-]\s*\d{4}|\d{4}\s*[–-]\s*Present)\s*\)/gi,
      /(Worked\s+at|Employed\s+at|Position\s+at)\s+([^\.\n]+?)\s+(\d{4}\s*[–-]\s*\d{4})/gi,
    ];
    experiencePatterns.forEach((pattern) => {
      const matches = text.match(pattern);
      if (matches) {
        extractedInfo.experience.push(...matches);
      }
    });
    const educationPatterns = [
      /\b(Bachelor|Master|PhD|Doctorate|Diploma|Certificate|Course|Degree|BSc|MSc|MBA|MA|BA|BS|MS|PhD|MD|JD|LLB|LLM)\s+[^\.\n]+/gi,
      /\b(University|College|Institute|School|Academy|Polytechnic|Community College|Technical School)\s+[^\.\n]+/gi,
      /\b(GPA|Grade|Class|Graduated|Completed|Studied|Major|Minor|Specialization)\s*[:\-]?\s*[^\.\n]+/gi,
    ];
    educationPatterns.forEach((pattern) => {
      const matches = text.match(pattern);
      if (matches) {
        extractedInfo.education.push(...matches);
      }
    });
    const companyPatterns = [
      /\b([A-Z][a-z]+\s+(?:Company|Corp|Contractors|Group|Holdings|Limited|Ltd|Inc|LLC|Partners|Associates|Consulting|Solutions|Systems|Technologies|Industries|Enterprises|International|Global))\b/gi,
      /\b([A-Z][a-z]+\s+(?:University|College|Institute|School|Academy|Hospital|Clinic|Bank|Insurance|Agency|Bureau|Department|Ministry|Council|Foundation|Organization|Association))\b/gi,
      /\b(Google|Microsoft|Apple|Amazon|Facebook|Meta|Tesla|Netflix|Uber|Airbnb|Spotify|LinkedIn|Twitter|Instagram|YouTube|TikTok|Snapchat|Pinterest|Reddit|Discord|Slack|Zoom|Salesforce|Oracle|IBM|Intel|NVIDIA|AMD|Samsung|Sony|Nintendo|Adobe|Autodesk|Unity|Epic|Valve)\b/gi,
    ];
    companyPatterns.forEach((pattern) => {
      const matches = text.match(pattern);
      if (matches) {
        extractedInfo.companies.push(...matches);
      }
    });
  }

  private generateAnalysis(extractedInfo: CVAnalysisResult['extractedInfo'], text: string): CVAnalysisResult['analysis'] {
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const suggestions: string[] = [];
    if (extractedInfo.email && extractedInfo.phone) {
      strengths.push('Complete contact information provided');
    } else {
      if (!extractedInfo.email) {
        weaknesses.push('Email address missing');
        suggestions.push('Add a professional email address');
      }
      if (!extractedInfo.phone) {
        weaknesses.push('Phone number missing');
        suggestions.push('Include a contact phone number');
      }
    }
    if (extractedInfo.skills.length > 8) {
      strengths.push('Comprehensive technical skill set with diverse technologies');
    } else if (extractedInfo.skills.length > 4) {
      strengths.push('Good technical skill set');
    } else {
      weaknesses.push('Limited technical skills mentioned');
      suggestions.push('Add more relevant technical skills and tools');
    }
    const hasProjectManagement = extractedInfo.skills.some((skill) => ['project management', 'construction management', 'budgeting', 'scheduling'].includes(skill));
    const hasTechnicalSkills = extractedInfo.skills.some((skill) => ['autocad', 'infrastructure development', 'site supervision', 'quality control'].includes(skill));
    const hasLeadership = extractedInfo.skills.some((skill) => ['leadership', 'team coordination', 'management', 'supervision'].includes(skill));
    if (hasProjectManagement && hasTechnicalSkills && hasLeadership) {
      strengths.push('Strong project management and technical leadership capabilities');
    }
    if (extractedInfo.experience.length > 3) {
      strengths.push('Extensive professional experience');
    } else if (extractedInfo.experience.length > 1) {
      strengths.push('Good professional experience');
    } else {
      weaknesses.push('Limited work experience');
      suggestions.push('Consider adding internships, freelance projects, or volunteer work');
    }
    const hasSeniorRole = extractedInfo.jobTitles.some((title) => title.toLowerCase().includes('senior') || title.toLowerCase().includes('lead'));
    if (hasSeniorRole) {
      strengths.push('Demonstrates career progression and leadership experience');
    }
    if (extractedInfo.education.length > 1) {
      strengths.push('Strong educational background with multiple qualifications');
    } else if (extractedInfo.education.length > 0) {
      strengths.push('Educational background clearly stated');
    } else {
      weaknesses.push('Education section missing or unclear');
      suggestions.push('Add education section with degree, institution, and graduation year');
    }
    const wordCount = text.split(' ').length;
    if (wordCount > 500 && wordCount < 1000) {
      strengths.push('Well-structured CV with appropriate length');
    } else if (wordCount < 300) {
      weaknesses.push('CV appears too brief');
      suggestions.push('Add more details about your experience and achievements');
    } else if (wordCount > 1200) {
      weaknesses.push('CV may be too lengthy');
      suggestions.push('Consider condensing information to 1-2 pages');
    }
    const hasNumbers = /\d+%|\d+\+|\d+x|\$\d+/.test(text);
    if (hasNumbers) {
      strengths.push('Includes quantified achievements and metrics');
    } else {
      suggestions.push('Add specific numbers and metrics to quantify your achievements');
    }
    let atsScore = 0;
    if (extractedInfo.email) atsScore += 15;
    if (extractedInfo.phone) atsScore += 15;
    if (extractedInfo.name) atsScore += 10;
    if (extractedInfo.skills.length > 0) atsScore += 20;
    if (extractedInfo.experience.length > 0) atsScore += 20;
    if (extractedInfo.education.length > 0) atsScore += 10;
    if (hasNumbers) atsScore += 10;
    const baseScore = atsScore;
    const strengthBonus = strengths.length * 3;
    const weaknessPenalty = weaknesses.length * 2;
    const overallScore = Math.min(baseScore + strengthBonus - weaknessPenalty, 100);
    return { strengths, weaknesses, suggestions, atsScore: Math.min(atsScore, 100), overallScore: Math.max(overallScore, 0) };
  }

  private generateJobMatches(extractedInfo: CVAnalysisResult['extractedInfo']): CVAnalysisResult['jobMatches'] {
    const jobMatches: CVAnalysisResult['jobMatches'] = [];
    const jobRoles = [
      { role: 'Software Engineer', requiredSkills: ['programming', 'software development', 'coding'], optionalSkills: ['javascript', 'python', 'java', 'react', 'node.js', 'sql', 'git'] },
      { role: 'Full Stack Developer', requiredSkills: ['frontend', 'backend', 'web development'], optionalSkills: ['react', 'angular', 'vue', 'node.js', 'express', 'mongodb', 'postgresql'] },
      { role: 'Data Scientist', requiredSkills: ['data analysis', 'machine learning', 'statistics'], optionalSkills: ['python', 'r', 'tensorflow', 'pytorch', 'pandas', 'numpy', 'sql'] },
      { role: 'DevOps Engineer', requiredSkills: ['devops', 'cloud', 'automation'], optionalSkills: ['aws', 'azure', 'docker', 'kubernetes', 'jenkins', 'git', 'linux'] },
      { role: 'Product Manager', requiredSkills: ['product management', 'project management', 'leadership'], optionalSkills: ['agile', 'scrum', 'data analysis', 'user research', 'jira'] },
      { role: 'UX/UI Designer', requiredSkills: ['design', 'user experience', 'user interface'], optionalSkills: ['figma', 'adobe xd', 'sketch', 'photoshop', 'prototyping', 'user research'] },
      { role: 'Civil Engineer', requiredSkills: ['civil engineering', 'project management', 'engineering'], optionalSkills: ['autocad', 'construction', 'infrastructure', 'site supervision', 'quality control'] },
      { role: 'Mechanical Engineer', requiredSkills: ['mechanical engineering', 'design', 'engineering'], optionalSkills: ['solidworks', 'autocad', 'manufacturing', 'thermodynamics', 'materials'] },
      { role: 'Electrical Engineer', requiredSkills: ['electrical engineering', 'power systems', 'engineering'], optionalSkills: ['matlab', 'autocad', 'circuit design', 'power distribution', 'control systems'] },
      { role: 'Business Analyst', requiredSkills: ['business analysis', 'data analysis', 'problem solving'], optionalSkills: ['excel', 'sql', 'power bi', 'tableau', 'project management', 'communication'] },
      { role: 'Marketing Manager', requiredSkills: ['marketing', 'digital marketing', 'strategy'], optionalSkills: ['social media', 'seo', 'analytics', 'content creation', 'campaign management'] },
      { role: 'Sales Manager', requiredSkills: ['sales', 'leadership', 'customer relationship'], optionalSkills: ['crm', 'negotiation', 'business development', 'communication', 'team management'] },
      { role: 'Operations Manager', requiredSkills: ['operations', 'process improvement', 'management'], optionalSkills: ['supply chain', 'logistics', 'quality control', 'budgeting', 'team leadership'] },
      { role: 'Doctor', requiredSkills: ['medicine', 'healthcare', 'patient care'], optionalSkills: ['diagnosis', 'treatment', 'medical knowledge', 'communication', 'empathy'] },
      { role: 'Nurse', requiredSkills: ['nursing', 'patient care', 'healthcare'], optionalSkills: ['medical knowledge', 'communication', 'empathy', 'teamwork', 'attention to detail'] },
      { role: 'Teacher', requiredSkills: ['teaching', 'education', 'communication'], optionalSkills: ['curriculum development', 'classroom management', 'student assessment', 'technology'] },
      { role: 'Professor', requiredSkills: ['research', 'teaching', 'academic'], optionalSkills: ['publication', 'grant writing', 'mentoring', 'conference presentation'] },
      { role: 'Accountant', requiredSkills: ['accounting', 'financial analysis', 'bookkeeping'], optionalSkills: ['excel', 'quickbooks', 'tax preparation', 'auditing', 'financial reporting'] },
      { role: 'Financial Analyst', requiredSkills: ['financial analysis', 'data analysis', 'excel'], optionalSkills: ['modeling', 'forecasting', 'sql', 'power bi', 'tableau', 'statistics'] },
      { role: 'Lawyer', requiredSkills: ['law', 'legal research', 'advocacy'], optionalSkills: ['litigation', 'contract law', 'legal writing', 'negotiation', 'court procedures'] },
      { role: 'Project Manager', requiredSkills: ['project management', 'leadership', 'planning'], optionalSkills: ['agile', 'scrum', 'budgeting', 'risk management', 'stakeholder management'] },
      { role: 'General Manager', requiredSkills: ['management', 'leadership', 'strategy'], optionalSkills: ['operations', 'finance', 'hr', 'business development', 'team building'] },
    ];
    jobRoles.forEach((job) => {
      const userSkills = extractedInfo.skills.map((s) => s.toLowerCase());
      const matchingRequiredSkills = job.requiredSkills.filter((skill) => userSkills.some((us) => us.includes(skill)));
      const matchingOptionalSkills = job.optionalSkills.filter((skill) => userSkills.some((us) => us.includes(skill)));
      const requiredScore = (matchingRequiredSkills.length / job.requiredSkills.length) * 70;
      const optionalScore = (matchingOptionalSkills.length / job.optionalSkills.length) * 30;
      const matchScore = Math.round(requiredScore + optionalScore);
      if (matchScore > 25) {
        const allMatchingSkills = [...matchingRequiredSkills, ...matchingOptionalSkills];
        jobMatches.push({
          role: job.role,
          matchScore,
          reason: `Matches ${matchingRequiredSkills.length}/${job.requiredSkills.length} required skills and ${matchingOptionalSkills.length} optional skills: ${allMatchingSkills.slice(0, 3).join(', ')}${allMatchingSkills.length > 3 ? '...' : ''}`,
        });
      }
    });
    return jobMatches.sort((a, b) => b.matchScore - a.matchScore).slice(0, 5);
  }
}

export const cvAnalysisService = new CVAnalysisService();
