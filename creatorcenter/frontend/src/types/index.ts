export interface Project {
  id: number;
  name: string;
  content_type: string;
  source_lang: string;
  target_lang: string | null;
  status: string;
  segment_count: number;
  share_code: string | null;
  is_published: boolean;
  created_at: string;
}

export interface ProjectDetail extends Project {
  original_file: string | null;
  markdown_content: string | null;
  updated_at: string;
  available_languages: string[];
}

export interface Segment {
  id: number;
  project_id: number;
  sequence: number;
  paragraph_index: number;
  container_paragraph_index: number | null;
  run_index: number;
  source_text: string;
  formatting_json: Record<string, any>;
  paragraph_formatting_json: Record<string, any>;
  container_type: string;
  container_index: number | null;
  table_row: number | null;
  table_col: number | null;
  translated_text: string | null;
  is_translated: boolean;
  ignored: boolean;
  translated_langs: Record<string, string>;
}

export interface PaginatedSegments {
  items: Segment[];
  total: number;
  page: number;
  page_size: number;
}

export interface TranslationPair {
  key_id: number;
  source_text: string;
  translated_text: string | null;
  is_edited: boolean;
  occurrence_count: number;
}

export interface TranslateStatus {
  status: string;
  translated_count: number;
  total_count: number;
}

export interface Language {
  code: string;
  name: string;
}

export const LANGUAGES: Language[] = [
  { code: "EN", name: "English" },
  { code: "DE", name: "German" },
  { code: "CN", name: "Chinese (Simplified)" },
  { code: "JP", name: "Japanese" },
  { code: "FR", name: "French" },
  { code: "ES", name: "Spanish" },
  { code: "KO", name: "Korean" },
  { code: "PT", name: "Portuguese" },
  { code: "IT", name: "Italian" },
  { code: "RU", name: "Russian" },
  { code: "AR", name: "Arabic" },
];
