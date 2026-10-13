import Fuse from "fuse.js";
import { nanoid } from "nanoid";
import { StoreKey } from "../constant";
import { getLang } from "../locales";
import { createPersistStore } from "../utils/store";
import * as storageModule from '../utils/storage';

export interface Prompt {
  id: string;
  isUser?: boolean;
  title: string;
  content: string;
  createdAt: number;
}

// OCR结果类型定义
interface OCRQuestionResult {
  type: string;
  content: string;
  timestamp: number;
}

export const SearchService = {
  ready: false,
  builtinEngine: new Fuse<Prompt>([], { keys: ["title"] }),
  userEngine: new Fuse<Prompt>([], { keys: ["title"] }),
  count: {
    builtin: 0,
  },
  allPrompts: [] as Prompt[],
  builtinPrompts: [] as Prompt[],
  ocrPrompt: null as Prompt | null,

  init(builtinPrompts: Prompt[], userPrompts: Prompt[]) {
    if (this.ready) {
      return;
    }
    this.allPrompts = userPrompts.concat(builtinPrompts);
    this.builtinPrompts = builtinPrompts.slice();
    this.builtinEngine.setCollection(builtinPrompts);
    this.userEngine.setCollection(userPrompts);
    this.ready = true;

    // 初始化时检查是否有共享的OCR结果
    this.checkOCRQuestionResult();
    
    // 添加storage事件监听
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', this.handleStorageChange.bind(this));
      console.log("已添加LocalStorage监听器，等待OCR结果");
    }
  },

  handleStorageChange(event: StorageEvent) {
    if (event.key === 'OCR_QUESTION_RESULT') {
      console.log("检测到OCR结果变化", event.newValue);
      this.checkOCRQuestionResult();
    }
  },

  checkOCRQuestionResult() {
    if (typeof window === 'undefined') return;

    try {
      const ocrResultStr = storageModule.getItem('OCR_QUESTION_RESULT');
      if (!ocrResultStr) {
        // 如果没有OCR结果，移除之前的OCR提示词
        if (this.ocrPrompt) {
          this.removeOCRPrompt();
        }
        return;
      }

      const ocrResult = JSON.parse(ocrResultStr as string) as OCRQuestionResult;
      if (ocrResult.type === 'OCR_QUESTION_RESULT') {
        // 创建或更新OCR提示词
        this.updateOCRPrompt(ocrResult.content);
      }
    } catch (error) {
      console.error("处理OCR结果失败:", error);
    }
  },

  updateOCRPrompt(content: string) {
    // 格式化为提示词
    const prompt: Prompt = {
      id: "ocr-question-result",
      isUser: true,
      title: "识别题目结果",
      content: content,
      createdAt: Date.now(),
    };

    // 如果之前有OCR提示词，先移除
    if (this.ocrPrompt) {
      this.removeOCRPrompt();
    }

    // 添加新的OCR提示词
    this.ocrPrompt = prompt;
    this.userEngine.add(prompt);
    this.allPrompts.unshift(prompt);
    
    // 确认OCR提示词是否已成功添加并打印前20个字符
    const contentPreview = content.length > 20 ? content.substring(0, 20) + "..." : content;
    const foundPrompt = this.search("识别题目结果").find(p => p.id === "ocr-question-result");
    
    if (foundPrompt) {
      console.log(`OCR识别结果添加成功！预览: "${contentPreview}"`);
      console.log(`%c识别题目已添加到补全提示词: ${contentPreview}`, 'color: green; font-weight: bold');
    } else {
      console.warn("OCR识别结果添加可能失败，未能在搜索结果中找到");
    }
  },

  removeOCRPrompt() {
    if (!this.ocrPrompt) return;
    
    // 移除OCR提示词
    this.userEngine.remove((doc) => doc.id === "ocr-question-result");
    this.allPrompts = this.allPrompts.filter(p => p.id !== "ocr-question-result");
    this.ocrPrompt = null;
    console.log("已移除OCR提示词");
  },

  remove(id: string) {
    this.userEngine.remove((doc) => doc.id === id);
  },

  add(prompt: Prompt) {
    this.userEngine.add(prompt);
  },

  search(text: string) {
    const userResults = this.userEngine.search(text);
    const builtinResults = this.builtinEngine.search(text);
    return userResults.concat(builtinResults).map((v) => v.item);
  },
};

export const usePromptStore = createPersistStore(
  {
    counter: 0,
    prompts: {} as Record<string, Prompt>,
  },

  (set, get) => ({
    add(prompt: Prompt) {
      const prompts = get().prompts;
      prompt.id = nanoid();
      prompt.isUser = true;
      prompt.createdAt = Date.now();
      prompts[prompt.id] = prompt;

      set(() => ({
        prompts: prompts,
      }));

      return prompt.id!;
    },

    get(id: string) {
      const targetPrompt = get().prompts[id];

      if (!targetPrompt) {
        return SearchService.builtinPrompts.find((v) => v.id === id);
      }

      return targetPrompt;
    },

    remove(id: string) {
      const prompts = get().prompts;
      delete prompts[id];

      Object.entries(prompts).some(([key, prompt]) => {
        if (prompt.id === id) {
          delete prompts[key];
          return true;
        }
        return false;
      });

      SearchService.remove(id);

      set(() => ({
        prompts,
        counter: get().counter + 1,
      }));
    },

    getUserPrompts() {
      const userPrompts = Object.values(get().prompts ?? {});
      userPrompts.sort((a, b) =>
        b.id && a.id ? b.createdAt - a.createdAt : 0,
      );
      return userPrompts;
    },

    updatePrompt(id: string, updater: (prompt: Prompt) => void) {
      const prompt = get().prompts[id] ?? {
        title: "",
        content: "",
        id,
      };

      SearchService.remove(id);
      updater(prompt);
      const prompts = get().prompts;
      prompts[id] = prompt;
      set(() => ({ prompts }));
      SearchService.add(prompt);
    },

    search(text: string) {
      if (text.length === 0) {
        // return all prompts
        return this.getUserPrompts().concat(SearchService.builtinPrompts);
      }
      return SearchService.search(text) as Prompt[];
    },
    
    // 手动触发OCR识别结果检查
    checkOCRQuestionResult() {
      SearchService.checkOCRQuestionResult();
    }
  }),
  {
    name: StoreKey.Prompt,
    version: 3,

    migrate(state, version) {
      const newState = JSON.parse(JSON.stringify(state)) as {
        prompts: Record<string, Prompt>;
      };

      if (version < 3) {
        Object.values(newState.prompts).forEach((p) => (p.id = nanoid()));
      }

      return newState as any;
    },

    onRehydrateStorage(state) {
      // Skip store rehydration on server side
      if (typeof window === "undefined") {
        return;
      }

      const PROMPT_URL = "./prompts.json";

      type PromptList = Array<[string, string]>;

      fetch(PROMPT_URL)
        .then((res) => res.json())
        .then((res) => {
          let fetchPrompts = [res.en, res.tw, res.cn];
          if (getLang() === "cn") {
            fetchPrompts = fetchPrompts.reverse();
          }
          const builtinPrompts = fetchPrompts.map((promptList: PromptList) => {
            return promptList.map(
              ([title, content]) =>
                ({
                  id: nanoid(),
                  title,
                  content,
                  createdAt: Date.now(),
                }) as Prompt,
            );
          });

          const userPrompts = usePromptStore.getState().getUserPrompts() ?? [];

          const allPromptsForSearch = builtinPrompts
            .reduce((pre, cur) => pre.concat(cur), [])
            .filter((v) => !!v.title && !!v.content);
          SearchService.count.builtin =
            res.en.length + res.cn.length + res.tw.length;
          SearchService.init(allPromptsForSearch, userPrompts);
        });
    },
  },
);
