import { create } from 'zustand'

export const useLibraryStore = create((set) => ({
  documents: [],

  setDocuments: (documents) => set({ documents }),

  // Upsert : si le doc existe déjà (ajout local + broadcast socket), pas de doublon
  addDocument: (doc) => set((state) => {
    if (state.documents.some(d => d.id === doc.id)) {
      return { documents: state.documents.map(d => d.id === doc.id ? { ...d, ...doc } : d) }
    }
    return { documents: [...state.documents, doc] }
  }),

  updateDocument: (updated) => set((state) => ({
    documents: state.documents.map(d => d.id === updated.id ? { ...d, ...updated } : d),
  })),

  removeDocument: (id) => set((state) => ({
    documents: state.documents.filter(d => d.id !== id),
  })),

  reset: () => set({ documents: [] }),
}))
