export type RelationshipType = "PARENT_OF" | "PARTNER_OF";

export type ParentRole = "father" | "mother";

export type PartnerRelationshipStatus =
  | "current"
  | "former"
  | "unknown";

/**
 * Clasificación interna de una unión familiar.
 *
 * - couple: existe una relación PARTNER_OF entre ambas personas.
 * - coParents: ambas personas comparten hijos, pero no existe PARTNER_OF.
 * - singleParent: solo hay un progenitor registrado en la unión.
 */
export type FamilyUnionKind =
  | "couple"
  | "coParents"
  | "singleParent";

export interface Person {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  secondLastName?: string;
  birthDate?: string;
  birthPlace?: string;
  isRoot?: boolean;
  soltero?: boolean;
}

export interface Relationship {
  id: string;
  fromPersonId: string;
  toPersonId: string;
  type: RelationshipType;
  parentRole?: ParentRole;
  relationshipStatus?: PartnerRelationshipStatus;
}

interface BaseUnion {
  id: string;
  partnerA: string;
  children: string[];
}

/**
 * Unión respaldada por una relación PARTNER_OF.
 */
export interface CoupleUnion extends BaseUnion {
  kind: "couple";
  partnerB: string;
  relationshipStatus: PartnerRelationshipStatus;
}

/**
 * Unión visual de dos progenitores que comparten hijos sin PARTNER_OF.
 *
 * Se construye automáticamente cuando dos personas comparten uno o más
 * hijos y no existe una relación PARTNER_OF entre ellas.
 */
export interface CoParentsUnion extends BaseUnion {
  kind: "coParents";
  partnerB: string;
}

/**
 * Unión con un solo progenitor registrado.
 *
 * Se conserva partnerB como cadena vacía durante esta etapa para mantener
 * compatibilidad con el layout actual, que ya interpreta ese valor como
 * ausencia de segundo progenitor.
 */
export interface SingleParentUnion extends BaseUnion {
  kind: "singleParent";
  partnerB: "";
}

export type Union =
  | CoupleUnion
  | CoParentsUnion
  | SingleParentUnion;

// Estructura utilizada por d3.hierarchy.
export interface TreeNode {
  id: string;
  type: "person" | "union";
  data: Person | Union;
  children?: TreeNode[];
}
