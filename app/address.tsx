import { auth, db } from '@/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    writeBatch
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

interface Address {
  id: string;
  label: string; 
  street: string;
  suburb: string;
  isDefault: boolean;
}

export default function AddressScreen() {
  const router = useRouter();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const addressRef = collection(db, "users", userId, "addresses");
    const unsubscribe = onSnapshot(query(addressRef), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Address[];
      setAddresses(data.sort((a, b) => (a.isDefault === b.isDefault ? 0 : a.isDefault ? -1 : 1)));
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // --- LOGIC: USE CURRENT LOCATION ---
 const useCurrentLocation = async () => {
    setLocating(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permission Denied", "We need location access to find your address.");
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      let geocode = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (geocode.length > 0) {
        const place = geocode[0];
        
        // FIX: Using 'district' for suburb and 'name'/'streetNumber' for the house info
        const streetNumber = place.name || ""; 
        const streetName = place.street || "";
        const fullStreet = `${streetNumber} ${streetName}`.trim();
        
        // Use district (suburb) and city
        const area = `${place.district || ""}, ${place.city || ""}`.trim();

        Alert.alert(
          "Address Found",
          `${fullStreet}\n${area}`,
          [
            { text: "Cancel", style: "cancel" },
            { text: "Save Address", onPress: () => saveNewAddress(fullStreet, area) }
          ]
        );
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Could not fetch your current location.");
    } finally {
      setLocating(false);
    }
  };

  const saveNewAddress = async (street: string, suburb: string) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    await addDoc(collection(db, "users", userId, "addresses"), {
      label: "Current Location",
      street,
      suburb,
      isDefault: addresses.length === 0, // Default if it's the first one
    });
  };

  // --- LOGIC: SET PRIMARY ---
  const setPrimary = async (addressId: string) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    
    const batch = writeBatch(db);
    addresses.forEach((addr) => {
      const ref = doc(db, "users", userId, "addresses", addr.id);
      batch.update(ref, { isDefault: addr.id === addressId });
    });
    await batch.commit();
  };

  // --- LOGIC: REMOVE ADDRESS ---
  const removeAddress = (id: string) => {
    Alert.alert("Remove Address", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
          const userId = auth.currentUser?.uid;
          if (userId) await deleteDoc(doc(db, "users", userId, "addresses", id));
      }}
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Shipping</Text>
        <TouchableOpacity onPress={useCurrentLocation} disabled={locating}>
          {locating ? <ActivityIndicator size="small" color="#FFD700" /> : <Ionicons name="location" size={24} color="#FFD700" />}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator color="#FFD700" /></View>
      ) : (
        <FlatList
          data={addresses}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="map-outline" size={80} color="#111" />
              <Text style={styles.emptyText}>Where should we send your luxury pieces?</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity 
                style={[styles.addressCard, item.isDefault && styles.activeCard]} 
                onPress={() => setPrimary(item.id)}
            >
              <View style={styles.cardHeader}>
                <View style={styles.labelRow}>
                  <Ionicons name={item.label === 'Home' ? 'home' : 'pin'} size={18} color={item.isDefault ? "#FFD700" : "#444"} />
                  <Text style={styles.addressLabel}>{item.label}</Text>
                </View>
                {item.isDefault && (
                  <View style={styles.defaultBadge}><Text style={styles.defaultText}>PRIMARY</Text></View>
                )}
              </View>
              
              <Text style={styles.addressText}>{item.street}</Text>
              <Text style={styles.suburbText}>{item.suburb}</Text>

              <View style={styles.cardActions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => removeAddress(item.id)}>
                  <Ionicons name="trash-outline" size={16} color="#FF4444" />
                  <Text style={[styles.actionBtnText, { color: '#FF4444' }]}>Remove</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity style={styles.addNewBtn} onPress={() => router.push('/AddAddressModal')}>
        <Ionicons name="add" size={20} color="#000" style={{marginRight: 8}} />
        <Text style={styles.addNewText}>Add New Address</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingHorizontal: 25, paddingBottom: 20 },
  backBtn: { width: 45, height: 45, borderRadius: 15, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#1a1a1a' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', letterSpacing: 1 },
  listContent: { padding: 20, paddingBottom: 120 },
  addressCard: { backgroundColor: '#0a0a0a', borderRadius: 25, padding: 20, marginBottom: 15, borderWidth: 1, borderColor: '#1a1a1a' },
  activeCard: { borderColor: '#FFD700', backgroundColor: '#0f0f00' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  labelRow: { flexDirection: 'row', alignItems: 'center' },
  addressLabel: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 10 },
  defaultBadge: { backgroundColor: '#FFD700', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  defaultText: { color: '#000', fontSize: 10, fontWeight: '900' },
  addressText: { color: '#fff', fontSize: 16, fontWeight: '500' },
  suburbText: { color: '#666', fontSize: 14, marginTop: 4 },
  cardActions: { flexDirection: 'row', marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#1a1a1a' },
  actionBtn: { flexDirection: 'row', alignItems: 'center' },
  actionBtnText: { fontSize: 13, fontWeight: '700', marginLeft: 6 },
  emptyState: { alignItems: 'center', marginTop: 100, paddingHorizontal: 40 },
  emptyText: { color: '#333', marginTop: 20, fontSize: 16, textAlign: 'center', lineHeight: 24 },
  addNewBtn: { position: 'absolute', bottom: 40, left: 20, right: 20, backgroundColor: '#FFD700', padding: 20, borderRadius: 20, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', elevation: 10, shadowColor: '#FFD700', shadowOpacity: 0.3, shadowRadius: 20 },
  addNewText: { color: '#000', fontWeight: '900', fontSize: 16, letterSpacing: 1 }
});