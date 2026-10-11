import { getSupabaseClient } from './client'
import type { Json } from './types'
import type { TravelPlan, ItineraryStop, EventGenre, Pace, Budget } from '../../domain'

export const tripsService = {
  async fetchPlans(userId = 'you'): Promise<TravelPlan[]> {
    const supabase = getSupabaseClient()
    if (!supabase) return []

    try {
      const { data, error } = await supabase
        .from('travel_plans')
        .select('*')
        .or(`user_id.eq.${userId},user_id.eq.you`)
        .order('created_at', { ascending: false })

      if (error || !data) {
        console.warn('[DO Supabase] Error fetching travel plans:', error)
        return []
      }

      return data.map((row) => ({
        id: row.id,
        title: row.title,
        destinationCity: row.destination_city,
        startDate: row.start_date,
        endDate: row.end_date,
        vibeTags: (row.vibe_tags || []) as EventGenre[],
        pace: (row.pace || 'balanced') as Pace,
        budget: (row.budget || 'all') as Budget,
        stops: (Array.isArray(row.stops) ? row.stops : []) as unknown as ItineraryStop[],
        createdAt: row.created_at || new Date().toISOString(),
      }))
    } catch (err) {
      console.warn('[DO Supabase] Failed to fetch travel plans:', err)
      return []
    }
  },

  async upsertPlan(plan: TravelPlan, userId = 'you'): Promise<boolean> {
    const supabase = getSupabaseClient()
    if (!supabase) return false

    try {
      const { error } = await supabase.from('travel_plans').upsert(
        {
          id: plan.id,
          title: plan.title,
          destination_city: plan.destinationCity,
          start_date: plan.startDate,
          end_date: plan.endDate,
          vibe_tags: plan.vibeTags,
          pace: plan.pace,
          budget: plan.budget,
          stops: plan.stops as unknown as Json,
          user_id: userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      )

      if (error) {
        console.warn('[DO Supabase] Error saving travel plan:', error)
        return false
      }
      return true
    } catch (err) {
      console.warn('[DO Supabase] Exception saving travel plan:', err)
      return false
    }
  },

  async deletePlan(planId: string): Promise<boolean> {
    const supabase = getSupabaseClient()
    if (!supabase) return false

    try {
      const { error } = await supabase.from('travel_plans').delete().eq('id', planId)
      return !error
    } catch {
      return false
    }
  },
}
