import { auth, db } from '@/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { addDoc, collection, getDocs, query } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import MapView, { Region } from 'react-native-maps';

export default function AddAddressModal() {
    const router = useRouter();
    const mapRef = useRef<MapView>(null);
    
    const [loading, setLoading] = useState(false);
    const [locatingUser, setLocatingUser] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState<any[]>([]);
    
    const [street, setStreet] = useState('');
    const [suburb, setSuburb] = useState('');
    const [selectedCoords, setSelectedCoords] = useState<{ latitude: number; longitude: number } | null>(null);

    // Initial center point (Gauteng default: Centurion/Pretoria area)
    const initialRegion: Region = {
        latitude: -25.8444,
        longitude: 28.1581,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
    };

    // --- GAUTENG VALIDATION ---
    const checkGauteng = (data: Location.LocationGeocodedAddress) => {
        const province = data.region?.toLowerCase() || '';
        const city = data.city?.toLowerCase() || '';
        const subregion = data.subregion?.toLowerCase() || '';
        return (
            province.includes('gauteng') || 
            city.includes('pretoria') || 
            city.includes('johannesburg') || 
            city.includes('centurion') ||
            subregion.includes('gauteng')
        );
    };

    // Automatically locate user on mount
    useEffect(() => {
        centerToUser();
    }, []);

    // --- SEARCH & SUGGESTIONS ---
    useEffect(() => {
        const fetchSuggestions = async () => {
            if (searchQuery.length > 3) {
                try {
                    const results = await Location.geocodeAsync(searchQuery);
                    const formatted = await Promise.all(
                        results.slice(0, 3).map(async (res) => {
                            const reverse = await Location.reverseGeocodeAsync(res);
                            return { ...res, address: reverse[0] };
                        })
                    );
                    setSuggestions(formatted);
                } catch (e) {
                    console.log('Geocoding error:', e);
                }
            } else {
                setSuggestions([]);
            }
        };

        const delay = setTimeout(fetchSuggestions, 400);
        return () => clearTimeout(delay);
    }, [searchQuery]);

    const selectSuggestion = (item: any) => {
        setSearchQuery('');
        setSuggestions([]);
        mapRef.current?.animateToRegion(
            {
                latitude: item.latitude,
                longitude: item.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
            },
            800
        );
    };

    // --- CENTER TO CURRENT USER LOCATION ---
    const centerToUser = async () => {
        try {
            setLocatingUser(true);
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert("Permission Denied", "Location access is required to pinpoint your address.");
                return;
            }
            let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            mapRef.current?.animateToRegion(
                {
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude,
                    latitudeDelta: 0.005,
                    longitudeDelta: 0.005,
                },
                1000
            );
        } catch (error) {
            console.log("Error getting location:", error);
        } finally {
            setLocatingUser(false);
        }
    };

    // --- REVERSE GEOCODE WHEN PIN MOVES ---
    const handleRegionChangeComplete = async (region: Region) => {
        setSelectedCoords({ latitude: region.latitude, longitude: region.longitude });
        try {
            const geocode = await Location.reverseGeocodeAsync({
                latitude: region.latitude,
                longitude: region.longitude,
            });

            if (geocode.length > 0) {
                const p = geocode[0];
                if (!checkGauteng(p)) {
                    setStreet("Outside Gauteng");
                    setSuburb("Delivery region not supported");
                } else {
                    const streetName = `${p.streetNumber || ''} ${p.street || p.name || ''}`.trim();
                    const subArea = p.district || p.subregion || p.city || 'Gauteng';
                    
                    setStreet(streetName || "Selected Pin Location");
                    setSuburb(subArea);
                }
            }
        } catch (e) {
            console.log("Reverse geocode error:", e);
        }
    };

    // --- SAVE TO FIRESTORE LOGIC ---
    const handleSaveAddress = async () => {
        if (!street.trim() || street === "Outside Gauteng") {
            Alert.alert("Invalid Area", "Only Gauteng delivery addresses are supported.");
            return;
        }

        const userId = auth.currentUser?.uid;
        if (!userId) {
            Alert.alert("Authentication Error", "You must be logged in to save an address.");
            return;
        }

        try {
            setLoading(true);
            const addressRef = collection(db, "users", userId, "addresses");
            
            const snapshot = await getDocs(query(addressRef));
            const isFirstAddress = snapshot.empty;

            await addDoc(addressRef, {
                label: 'Pinned Location',
                street: street.trim(),
                suburb: suburb.trim(),
                coordinates: selectedCoords,
                isDefault: isFirstAddress,
                createdAt: new Date(),
            });

            router.back();
        } catch (error) {
            console.error("Error saving address: ", error);
            Alert.alert("Error", "Could not save address. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const isOutside = street === "Outside Gauteng";

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <View style={styles.container}>
                {/* Header Nav */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
                        <Ionicons name="close" size={20} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>SET DESTINATION</Text>
                    <View style={{ width: 40 }} />
                </View>

                {/* Main Map Container */}
                <View style={styles.mapWrapper}>
                    <MapView 
                        ref={mapRef}
                        style={styles.map} 
                        initialRegion={initialRegion} 
                        onRegionChangeComplete={handleRegionChangeComplete}
                        userInterfaceStyle="dark"
                        customMapStyle={darkMapStyle}
                        showsUserLocation={true}
                        showsCompass={false}
                    />

                    {/* Floating Search Bar */}
                    <View style={styles.searchWrapper}>
                        <View style={styles.searchBar}>
                            <Ionicons name="search" size={18} color="#888" style={{ marginRight: 10 }} />
                            <TextInput 
                                style={styles.searchInput} 
                                placeholder="Search Gauteng street or area..." 
                                placeholderTextColor="#666" 
                                value={searchQuery} 
                                onChangeText={setSearchQuery} 
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')}>
                                    <Ionicons name="close-circle" size={18} color="#666" />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Search Suggestions Dropdown */}
                        {suggestions.map((item, idx) => (
                            <TouchableOpacity 
                                key={idx} 
                                style={styles.suggestionItem} 
                                onPress={() => selectSuggestion(item)}
                            >
                                <Ionicons name="location-sharp" size={18} color="#FFD700" />
                                <Text style={styles.suggestionText} numberOfLines={1}>
                                    {item.address.street || item.address.name}, {item.address.district || item.address.city}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Fixed Center Location Pin */}
                    <View style={styles.pinContainer} pointerEvents="none">
                        <View style={styles.pinWrapper}>
                            <Ionicons name="location" size={42} color={isOutside ? "#FF4444" : "#FFD700"} />
                            <View style={[styles.pinShadow, isOutside && { backgroundColor: 'rgba(255, 68, 68, 0.4)' }]} />
                        </View>
                    </View>

                    {/* Center To User Button */}
                    <TouchableOpacity style={styles.centerBtn} onPress={centerToUser} disabled={locatingUser}>
                        {locatingUser ? (
                            <ActivityIndicator size="small" color="#000" />
                        ) : (
                            <Ionicons name="locate" size={22} color="#000" />
                        )}
                    </TouchableOpacity>

                    {/* Floating Address Preview Card & Dynamic Footer Action */}
                    <View style={styles.bottomCardContainer}>
                        <View style={[styles.previewBox, isOutside && { borderColor: '#FF4444' }]}>
                            <View style={styles.previewHeader}>
                                <View style={[styles.statusDot, { backgroundColor: isOutside ? '#FF4444' : '#00E676' }]} />
                                <Text style={styles.badgeText}>{isOutside ? "UNSUPPORTED AREA" : "DELIVERY ADDRESS"}</Text>
                            </View>
                            
                            <Text style={[styles.previewTitle, isOutside && { color: '#FF4444' }]} numberOfLines={1}>
                                {street || "Drag map to select address..."}
                            </Text>
                            <Text style={styles.previewSub} numberOfLines={1}>
                                {suburb}
                            </Text>
                        </View>

                        <TouchableOpacity 
                            style={[
                                styles.saveBtn, 
                                (isOutside || !street) && styles.saveBtnDisabled
                            ]} 
                            onPress={handleSaveAddress}
                            disabled={isOutside || !street || loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#000" />
                            ) : (
                                <Text style={styles.saveBtnText}>CONFIRM GAUTENG ADDRESS</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </GestureHandlerRootView>
    );
}

// Dark Mode Style Preset for Google Maps
const darkMapStyle = [
    { elementType: 'geometry', stylers: [{ color: '#212121' }] },
    { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
    { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#757575' }] },
    { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
    { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#2c2c2c' }] },
    { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#3c3c3c' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000000' }] }
];

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        paddingTop: 55, 
        paddingHorizontal: 20, 
        paddingBottom: 15,
        backgroundColor: '#000',
        zIndex: 10
    },
    closeBtn: { 
        width: 36, 
        height: 36, 
        borderRadius: 18, 
        backgroundColor: '#121212', 
        justifyContent: 'center', 
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#222'
    },
    headerTitle: { color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 2 },
    mapWrapper: { flex: 1, position: 'relative' },
    map: { flex: 1 },
    searchWrapper: { position: 'absolute', top: 15, left: 20, right: 20, zIndex: 20 },
    searchBar: { 
        backgroundColor: 'rgba(15,15,15,0.92)', 
        borderRadius: 16, 
        paddingHorizontal: 16, 
        height: 52, 
        flexDirection: 'row',
        alignItems: 'center', 
        borderWidth: 1, 
        borderColor: '#262626' 
    },
    searchInput: { color: '#fff', flex: 1, fontSize: 14 },
    suggestionItem: { 
        backgroundColor: 'rgba(20,20,20,0.98)', 
        padding: 14, 
        borderBottomWidth: 1, 
        borderBottomColor: '#222', 
        flexDirection: 'row', 
        alignItems: 'center' 
    },
    suggestionText: { color: '#fff', marginLeft: 10, fontSize: 13, flex: 1 },
    pinContainer: { 
        position: 'absolute', 
        left: '50%', 
        top: '50%', 
        marginLeft: -21, 
        marginTop: -42,
        alignItems: 'center',
        justifyContent: 'center'
    },
    pinWrapper: { alignItems: 'center' },
    pinShadow: {
        width: 12,
        height: 4,
        borderRadius: 6,
        backgroundColor: 'rgba(255, 215, 0, 0.4)',
        marginTop: -2
    },
    centerBtn: { 
        position: 'absolute', 
        bottom: 210, 
        right: 20, 
        width: 46, 
        height: 46, 
        borderRadius: 23, 
        backgroundColor: '#FFD700', 
        justifyContent: 'center', 
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 6
    },
    bottomCardContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#000',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 35,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderTopWidth: 1,
        borderColor: '#181818'
    },
    previewBox: { 
        backgroundColor: '#0A0A0A', 
        padding: 16, 
        borderRadius: 16, 
        borderWidth: 1, 
        borderColor: '#1E1E1E',
        marginBottom: 16
    },
    previewHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
    badgeText: { color: '#888', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
    previewTitle: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
    previewSub: { color: '#777', fontSize: 12, marginTop: 2 },
    saveBtn: { 
        backgroundColor: '#FFD700', 
        height: 54,
        borderRadius: 16, 
        alignItems: 'center',
        justifyContent: 'center'
    },
    saveBtnDisabled: {
        backgroundColor: '#222',
        opacity: 0.6
    },
    saveBtnText: { color: '#000', fontWeight: '900', fontSize: 12, letterSpacing: 1 }
});