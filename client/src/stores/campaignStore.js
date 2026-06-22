import { create } from 'zustand'

export const useCampaignStore = create((set) => ({
  campaign: null,

  setCampaign: (campaign) => set({ campaign }),

  updateCampaign: (partial) => set((state) => ({
    campaign: state.campaign ? { ...state.campaign, ...partial } : state.campaign,
  })),
}))
