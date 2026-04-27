export interface GuideStep {
  title: string;
  description: string;
}

export interface ModuleGuide {
  id: string;
  title: string;
  description: string;
  icon: string;
  purpose: string;
  features: string[];
  actions: { name: string; description: string }[];
  steps: GuideStep[];
  relatedModules: string[];
  tips: string[];
}

export const modules: ModuleGuide[] = [];
