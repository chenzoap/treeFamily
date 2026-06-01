export type RelationshipType = "PARENT_OF" | "PARTNER_OF";

export interface Person {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  secondLastName?: string;
  birthDate?: string;
  birthPlace?: string;
  isRoot?: boolean;
  soltero?: boolean; // NUEVO (opcional para compat)
}

export interface Relationship {
  id: string;
  fromPersonId: string;
  toPersonId: string;
  type: RelationshipType;
  parentRole?: "father" | "mother";
}

export interface Union {
  id: string;
  partnerA: string; 
  partnerB: string; 
  children: string[]; 
}

// Estructura para d3.hierarchy
export interface TreeNode {
  id: string;
  type: 'person' | 'union';
  // Guardamos la referencia al objeto original para acceder a sus datos
  data: Person | Union;
  children?: TreeNode[];
}