export interface GEvent {
  date?: string;
  plac?: string;
  type?: string;
  file?: string;
  titl?: string;
  form?: string;
}

export interface Indi {
  id: string;
  name?: string;
  surn?: string;
  givn?: string;
  sex?: 'M' | 'F' | string;
  occu?: string;
  reli?: string;
  conf?: string; // _CONF A|B|C
  quay?: number; // 0..3
  notes: string[];
  sources: string[];
  todo: string[];
  fams: string[];
  famc: string | null;
  birt?: GEvent;
  deat?: GEvent;
  buri?: GEvent;
  resi?: GEvent;
  media: GEvent[];
  photo?: string;       // портрет (для аватара)
  documents: GEvent[];  // сканы документов (наградные, донесения, карточки)
}

export interface Fam {
  id: string;
  husb?: string;
  wife?: string;
  chil: string[];
  notes: string[];
}

export interface Tree {
  indi: Record<string, Indi>;
  fam: Record<string, Fam>;
}

export type Side = 'paternal' | 'maternal' | 'self';
