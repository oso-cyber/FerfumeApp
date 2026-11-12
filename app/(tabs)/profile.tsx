import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import React from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { auth } from '../../firebaseConfig';

/**
 * Reusable Menu Item Component
 */
const ProfileItem = ({ icon, label, onPress, color = '#fff' }: any) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
    <View style={styles.menuLeft}>
      <View style={styles.iconContainer}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={[styles.menuLabel, { color }]}>{label}</Text>
    </View>
    <Ionicons name="chevron-forward" size={18} color="#444" />
  </TouchableOpacity>
);

export default function ProfileScreen() {
  const router = useRouter();
  const user = auth.currentUser;

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to sign out of your account?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive', 
          onPress: async () => {
            try {
              await signOut(auth);
              router.replace('/LoginScreen'); 
            } catch (error) {
              Alert.alert('Error', 'Failed to log out. Please try again.');
            }
          } 
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <View style={styles.avatarLarge}>
            <Ionicons name="person" size={50} color="#333" />
          </View>
          <Text style={styles.userName}>{user?.displayName || 'Exquisite Member'}</Text>
          <Text style={styles.userEmail}>{user?.email || 'member@eldovillage.com'}</Text>
          
          <TouchableOpacity 
            style={styles.editButton}
            onPress={() => router.push('/edit')}
          >
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <ProfileItem 
            icon="heart-outline" 
            label="My Wishlist" 
            onPress={() => router.push('/wishlist')} 
          />
          <ProfileItem 
            icon="receipt-outline" 
            label="Order History" 
            onPress={() => router.push('/orders')} 
          />
          <ProfileItem 
            icon="location-outline" 
            label="Shipping Address" 
            onPress={() => router.push('/address')} 
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <ProfileItem 
            icon="notifications-outline" 
            label="Notifications" 
            onPress={() => router.push('/notifications')} 
          />
          <ProfileItem 
            icon="shield-checkmark-outline" 
            label="Privacy & Security" 
            onPress={() => router.push('/privacy')} 
          />
          <ProfileItem 
            icon="help-circle-outline" 
            label="Support" 
            onPress={() => router.push('/support')} 
          />
        </View>

        <View style={[styles.section, { marginBottom: 60 }]}>
          <ProfileItem 
            icon="log-out-outline" 
            label="Logout" 
            onPress={handleLogout} 
            color="#FF4444" 
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  scrollContent: { paddingTop: 80, paddingHorizontal: 20 },
  header: { alignItems: 'center', marginBottom: 40 },
  avatarLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  userName: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  userEmail: { color: '#666', fontSize: 14, marginTop: 5 },
  editButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 25,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  editButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  section: { marginBottom: 30 },
  sectionTitle: {
    color: '#444',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 15,
    marginLeft: 5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0a0a0a',
    padding: 15,
    borderRadius: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#111',
  },
  menuLeft: { flexDirection: 'row', alignItems: 'center' },
  iconContainer: {
    width: 35,
    height: 35,
    borderRadius: 10,
    backgroundColor: '#151515',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  menuLabel: { fontSize: 16, fontWeight: '500' },
});