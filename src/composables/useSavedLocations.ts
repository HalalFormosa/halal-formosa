import { ref, computed } from 'vue';
import { supabase } from '@/plugins/supabaseClient';
import type { SavedLocationFolder, SavedLocation } from '@/types/SavedLocation';

const folders = ref<SavedLocationFolder[]>([]);
const savedLocations = ref<SavedLocation[]>([]);
const loading = ref(false);
const savedLocationIds = ref<Set<number>>(new Set());

const totalSavedCount = computed(() => {
  return folders.value.reduce((acc, folder) => acc + (folder.saved_locations?.length || 0), 0);
});

// Supabase can return single object or array for relations
type SupabaseLocation = {
  id: number;
  name: string;
  address: string | null;
  image: string | null;
  location_types: Array<{ name: string }> | { name: string } | null;
  partner: Array<{ partner_tier: string | null }> | { partner_tier: string | null } | null;
};

type SavedLocationWithLocations = {
  id: string;
  folder_id: string;
  location_id: number;
  created_at: string;
  locations: SupabaseLocation[] | SupabaseLocation | null;
};

export function useSavedLocations() {
  async function loadFoldersAndSavedLocations() {
    loading.value = true;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      loading.value = false;
      return;
    }

    // 1. Fetch folders
    const { data: folderData, error: folderError } = await supabase
      .from('saved_location_folders')
      .select('id, name, created_at, updated_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (folderError) {
      console.error('Error loading folders:', folderError);
      loading.value = false;
      return;
    }

    if (!folderData || folderData.length === 0) {
      folders.value = [];
      savedLocations.value = [];
      savedLocationIds.value = new Set();
      loading.value = false;
      return;
    }

    // 2. Fetch saved locations with location details
    const { data: savedData, error: savedError } = await supabase
      .from('saved_locations')
      .select(`
        id,
        folder_id,
        location_id,
        created_at,
        locations ( id, name, address, image, location_types ( name ), partner:partners ( partner_tier ) )
      `)
      .eq('user_id', user.id);

    if (savedError) {
      console.error('Error loading saved locations:', savedError);
    }

    // 3. Map locations to folders - flatten the locations array and nested relations from Supabase
    const mappedFolders: SavedLocationFolder[] = folderData.map(folder => {
      const folderSavedLocations = (savedData as SavedLocationWithLocations[] || [])
        .filter(item => item.folder_id === folder.id)
        .map(item => {
          // Supabase can return locations as array OR single object
          const rawLocation: SupabaseLocation | undefined = item.locations 
            ? Array.isArray(item.locations) && item.locations.length > 0
              ? item.locations[0]
              : (item.locations as SupabaseLocation)
            : undefined;
          // Flatten location_types (can be array or object)
          const rawLocationTypes = rawLocation?.location_types;
          const locationTypes = rawLocationTypes
            ? Array.isArray(rawLocationTypes) && rawLocationTypes.length > 0
              ? rawLocationTypes[0]
              : (rawLocationTypes as { name: string })
            : undefined;
          // Extract partner_tier (partner can be array, object, or null)
          const rawPartner = rawLocation?.partner;
          const partnerTier = rawPartner
            ? Array.isArray(rawPartner) && rawPartner.length > 0
              ? rawPartner[0]?.partner_tier
              : (rawPartner as { partner_tier: string | null })?.partner_tier ?? null
            : null;
          return {
            ...item,
            locations: rawLocation ? {
              id: rawLocation.id,
              name: rawLocation.name,
              address: rawLocation.address,
              image: rawLocation.image,
              location_types: locationTypes,
              partner_tier: partnerTier
            } : undefined
          };
        }) as SavedLocation[];
      
      return {
        ...folder,
        saved_locations: folderSavedLocations
      };
    });

    folders.value = mappedFolders;
    
    // Flatten saved locations for the list
    savedLocations.value = (savedData as SavedLocationWithLocations[] || []).map(item => {
      // Supabase can return locations as array OR single object
      const rawLocation: SupabaseLocation | undefined = item.locations 
        ? Array.isArray(item.locations) && item.locations.length > 0
          ? item.locations[0]
          : (item.locations as SupabaseLocation)
        : undefined;
      // Flatten location_types (can be array or object)
      const rawLocationTypes = rawLocation?.location_types;
      const locationTypes = rawLocationTypes
        ? Array.isArray(rawLocationTypes) && rawLocationTypes.length > 0
          ? rawLocationTypes[0]
          : (rawLocationTypes as { name: string })
        : undefined;
      // Extract partner_tier (partner can be array, object, or null)
      const rawPartner = rawLocation?.partner;
      const partnerTier = rawPartner
        ? Array.isArray(rawPartner) && rawPartner.length > 0
          ? rawPartner[0]?.partner_tier
          : (rawPartner as { partner_tier: string | null })?.partner_tier ?? null
        : null;
      return {
        ...item,
        locations: rawLocation ? {
          id: rawLocation.id,
          name: rawLocation.name,
          address: rawLocation.address,
          image: rawLocation.image,
          location_types: locationTypes,
          partner_tier: partnerTier
        } : undefined
      };
    }) as SavedLocation[];
    
    // Update saved location IDs set for quick lookup
    savedLocationIds.value = new Set(savedData?.map(item => item.location_id) || []);
    
    loading.value = false;
  }

  async function createFolder(name: string): Promise<SavedLocationFolder | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('saved_location_folders')
      .insert({ user_id: user.id, name })
      .select()
      .single();

    if (error) {
      console.error('Error creating folder:', error);
      return null;
    }

    return data;
  }

  async function saveLocation(locationId: number, folderId: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // Check if already saved in this folder
    const { data: existing } = await supabase
      .from('saved_locations')
      .select('id')
      .eq('user_id', user.id)
      .eq('folder_id', folderId)
      .eq('location_id', locationId)
      .maybeSingle();

    if (existing) {
      return false; // Already exists
    }

    const { error } = await supabase
      .from('saved_locations')
      .insert({
        user_id: user.id,
        folder_id: folderId,
        location_id: locationId
      });

    if (error) {
      console.error('Error saving location:', error);
      return false;
    }

    savedLocationIds.value.add(locationId);
    return true;
  }

  async function unsaveLocation(savedId: string): Promise<boolean> {
    const { error } = await supabase
      .from('saved_locations')
      .delete()
      .eq('id', savedId);

    if (error) {
      console.error('Error unsaving location:', error);
      return false;
    }

    // Refresh to update the IDs set
    await loadFoldersAndSavedLocations();
    return true;
  }

  async function moveLocation(savedId: string, targetFolderId: string, locationId: number): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // Check if already exists in target folder
    const { data: existing } = await supabase
      .from('saved_locations')
      .select('id')
      .eq('user_id', user.id)
      .eq('folder_id', targetFolderId)
      .eq('location_id', locationId)
      .maybeSingle();

    if (existing) {
      return false; // Already exists in target folder
    }

    // Insert into new folder
    const { error: insertError } = await supabase
      .from('saved_locations')
      .insert({
        user_id: user.id,
        folder_id: targetFolderId,
        location_id: locationId
      });

    if (insertError) {
      console.error('Error moving location:', insertError);
      return false;
    }

    // Delete from old folder
    await supabase.from('saved_locations').delete().eq('id', savedId);

    await loadFoldersAndSavedLocations();
    return true;
  }

  function isLocationSaved(locationId: number): boolean {
    return savedLocationIds.value.has(locationId);
  }

  async function checkSavedState(locationId: number): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data } = await supabase
      .from('saved_locations')
      .select('id')
      .eq('user_id', user.id)
      .eq('location_id', locationId)
      .maybeSingle();

    const isSaved = !!data;
    if (isSaved) {
      savedLocationIds.value.add(locationId);
    } else {
      savedLocationIds.value.delete(locationId);
    }
    return isSaved;
  }

  async function deleteFolder(folderId: string): Promise<boolean> {
    const { error } = await supabase
      .from('saved_location_folders')
      .delete()
      .eq('id', folderId);

    if (error) {
      console.error('Error deleting folder:', error);
      return false;
    }

    await loadFoldersAndSavedLocations();
    return true;
  }

  return {
    folders,
    savedLocations,
    loading,
    totalSavedCount,
    savedLocationIds,
    loadFoldersAndSavedLocations,
    createFolder,
    saveLocation,
    unsaveLocation,
    moveLocation,
    isLocationSaved,
    checkSavedState,
    deleteFolder
  };
}
