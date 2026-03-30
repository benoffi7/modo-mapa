export interface SharedList {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  isPublic: boolean;
  featured: boolean;
  editorIds: string[];
  itemCount: number;
  icon?: string | undefined;
  color?: string | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListItem {
  id: string;
  listId: string;
  businessId: string;
  addedBy: string;
  createdAt: Date;
}
