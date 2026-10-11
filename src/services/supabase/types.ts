export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.5'
  }
  public: {
    Tables: {
      beacons: {
        Row: {
          city: string
          created_at: string | null
          expires_at: string
          id: string
          interests: string[] | null
          latitude: number
          longitude: number
          radius_km: number | null
          user_avatar: string
          user_id: string
          user_name: string
          vibe_message: string
        }
        Insert: {
          city: string
          created_at?: string | null
          expires_at: string
          id: string
          interests?: string[] | null
          latitude: number
          longitude: number
          radius_km?: number | null
          user_avatar: string
          user_id: string
          user_name: string
          vibe_message: string
        }
        Update: {
          city?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          interests?: string[] | null
          latitude?: number
          longitude?: number
          radius_km?: number | null
          user_avatar?: string
          user_id?: string
          user_name?: string
          vibe_message?: string
        }
        Relationships: []
      }
      community_profiles: {
        Row: {
          avatar: string | null
          bio: string | null
          city: string | null
          created_at: string | null
          handle: string
          id: string
          interests: string[] | null
          is_guest: boolean | null
          is_org: boolean | null
          name: string
          org_name: string | null
          trust_score: number | null
          updated_at: string | null
        }
        Insert: {
          avatar?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string | null
          handle: string
          id: string
          interests?: string[] | null
          is_guest?: boolean | null
          is_org?: boolean | null
          name: string
          org_name?: string | null
          trust_score?: number | null
          updated_at?: string | null
        }
        Update: {
          avatar?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string | null
          handle?: string
          id?: string
          interests?: string[] | null
          is_guest?: boolean | null
          is_org?: boolean | null
          name?: string
          org_name?: string | null
          trust_score?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      community_rsvps: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          profile_id: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id: string
          profile_id: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          profile_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'community_rsvps_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
        ]
      }
      event_messages: {
        Row: {
          avatar: string
          body: string
          created_at: string | null
          event_id: string
          id: string
          user_name: string
        }
        Insert: {
          avatar: string
          body: string
          created_at?: string | null
          event_id: string
          id: string
          user_name: string
        }
        Update: {
          avatar?: string
          body?: string
          created_at?: string | null
          event_id?: string
          id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: 'event_messages_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
        ]
      }
      event_reviews: {
        Row: {
          attended: boolean | null
          compliments: string[] | null
          created_at: string | null
          event_id: string
          id: string
          notes: string | null
          rating: number
          user_id: string
        }
        Insert: {
          attended?: boolean | null
          compliments?: string[] | null
          created_at?: string | null
          event_id: string
          id: string
          notes?: string | null
          rating: number
          user_id: string
        }
        Update: {
          attended?: boolean | null
          compliments?: string[] | null
          created_at?: string | null
          event_id?: string
          id?: string
          notes?: string | null
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'event_reviews_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
        ]
      }
      events: {
        Row: {
          address: string | null
          archived: boolean | null
          category: string
          city: string | null
          concluded: boolean | null
          country: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          district: string | null
          emoji: string | null
          end_date: string | null
          end_time: string | null
          end_time_iso: string | null
          exact_venue: string | null
          genre: string | null
          google_drive_file_id: string | null
          host_avatar: string | null
          host_handle: string | null
          host_id: string | null
          host_name: string
          host_trust: number | null
          id: string
          image_url: string | null
          is_custom: boolean | null
          is_online: boolean | null
          is_paid: boolean | null
          is_scraped: boolean | null
          is_unlimited: boolean | null
          is_verified: boolean | null
          is_verified_global: boolean | null
          joined_count: number | null
          latitude: number
          location: string
          location_precision: string | null
          longitude: number
          max_people: number | null
          media_url: string | null
          meeting_url: string | null
          min_trust_score: number | null
          official_links: Json | null
          official_mentions: Json | null
          price: number | null
          price_amount: number | null
          price_known: boolean | null
          price_tier: string | null
          private_venue: boolean | null
          provenance: string | null
          radius_km: number | null
          rating: number | null
          raw_data: Json | null
          registration_status: string | null
          registration_url: string | null
          source_hash: string | null
          source_platform: string | null
          source_url: string | null
          start_date: string | null
          start_time: string | null
          start_time_iso: string | null
          state: string | null
          status: string | null
          storage_provider: string | null
          tags: string[] | null
          time: string | null
          title: string
          venue_name: string | null
          verification: Json | null
          verification_score: number | null
          verified_by: string | null
        }
        Insert: {
          address?: string | null
          archived?: boolean | null
          category?: string
          city?: string | null
          concluded?: boolean | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          district?: string | null
          emoji?: string | null
          end_date?: string | null
          end_time?: string | null
          end_time_iso?: string | null
          exact_venue?: string | null
          genre?: string | null
          google_drive_file_id?: string | null
          host_avatar?: string | null
          host_handle?: string | null
          host_id?: string | null
          host_name?: string
          host_trust?: number | null
          id: string
          image_url?: string | null
          is_custom?: boolean | null
          is_online?: boolean | null
          is_paid?: boolean | null
          is_scraped?: boolean | null
          is_unlimited?: boolean | null
          is_verified?: boolean | null
          is_verified_global?: boolean | null
          joined_count?: number | null
          latitude: number
          location?: string
          location_precision?: string | null
          longitude: number
          max_people?: number | null
          media_url?: string | null
          meeting_url?: string | null
          min_trust_score?: number | null
          official_links?: Json | null
          official_mentions?: Json | null
          price?: number | null
          price_amount?: number | null
          price_known?: boolean | null
          price_tier?: string | null
          private_venue?: boolean | null
          provenance?: string | null
          radius_km?: number | null
          rating?: number | null
          raw_data?: Json | null
          registration_status?: string | null
          registration_url?: string | null
          source_hash?: string | null
          source_platform?: string | null
          source_url?: string | null
          start_date?: string | null
          start_time?: string | null
          start_time_iso?: string | null
          state?: string | null
          status?: string | null
          storage_provider?: string | null
          tags?: string[] | null
          time?: string | null
          title: string
          venue_name?: string | null
          verification?: Json | null
          verification_score?: number | null
          verified_by?: string | null
        }
        Update: {
          address?: string | null
          archived?: boolean | null
          category?: string
          city?: string | null
          concluded?: boolean | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          district?: string | null
          emoji?: string | null
          end_date?: string | null
          end_time?: string | null
          end_time_iso?: string | null
          exact_venue?: string | null
          genre?: string | null
          google_drive_file_id?: string | null
          host_avatar?: string | null
          host_handle?: string | null
          host_id?: string | null
          host_name?: string
          host_trust?: number | null
          id?: string
          image_url?: string | null
          is_custom?: boolean | null
          is_online?: boolean | null
          is_paid?: boolean | null
          is_scraped?: boolean | null
          is_unlimited?: boolean | null
          is_verified?: boolean | null
          is_verified_global?: boolean | null
          joined_count?: number | null
          latitude?: number
          location?: string
          location_precision?: string | null
          longitude?: number
          max_people?: number | null
          media_url?: string | null
          meeting_url?: string | null
          min_trust_score?: number | null
          official_links?: Json | null
          official_mentions?: Json | null
          price?: number | null
          price_amount?: number | null
          price_known?: boolean | null
          price_tier?: string | null
          private_venue?: boolean | null
          provenance?: string | null
          radius_km?: number | null
          rating?: number | null
          raw_data?: Json | null
          registration_status?: string | null
          registration_url?: string | null
          source_hash?: string | null
          source_platform?: string | null
          source_url?: string | null
          start_date?: string | null
          start_time?: string | null
          start_time_iso?: string | null
          state?: string | null
          status?: string | null
          storage_provider?: string | null
          tags?: string[] | null
          time?: string | null
          title?: string
          venue_name?: string | null
          verification?: Json | null
          verification_score?: number | null
          verified_by?: string | null
        }
        Relationships: []
      }
      travel_plans: {
        Row: {
          budget: string
          created_at: string | null
          destination_city: string
          end_date: string
          id: string
          pace: string
          start_date: string
          stops: Json
          title: string
          updated_at: string | null
          user_id: string | null
          vibe_tags: string[]
        }
        Insert: {
          budget?: string
          created_at?: string | null
          destination_city: string
          end_date: string
          id: string
          pace?: string
          start_date: string
          stops?: Json
          title: string
          updated_at?: string | null
          user_id?: string | null
          vibe_tags?: string[]
        }
        Update: {
          budget?: string
          created_at?: string | null
          destination_city?: string
          end_date?: string
          id?: string
          pace?: string
          start_date?: string
          stops?: Json
          title?: string
          updated_at?: string | null
          user_id?: string | null
          vibe_tags?: string[]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
