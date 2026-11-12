import { auth } from '@/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { updateProfile } from 'firebase/auth';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export default function EditProfileScreen() {
  const router = useRouter();
  const user = auth.currentUser;

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!displayName.trim()) {
      Alert.alert("Error", "Name cannot be empty");
      return;
    }

    setLoading(true);
    try {
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: displayName,
        });
        Alert.alert("Success", "Profile updated successfully!");
        router.back();
      }
    } catch (error) {
      Alert.alert("Error", "Failed to update profile.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color="#FFD700" />
          ) : (
            <Text style={styles.saveText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* AVATAR SECTION */}
        <View style={styles.avatarContainer}>
          <View style={styles.avatarCircle}>
            <Ionicons name="person" size={60} color="#333" />
            <TouchableOpacity style={styles.cameraIcon}>
              <Ionicons name="camera" size={20} color="#000" />
            </TouchableOpacity>
          </View>
          <Text style={styles.changePhotoText}>Change Profile Photo</Text>
        </View>

        {/* INPUTS */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Enter your name"
            placeholderTextColor="#444"
            selectionColor="#FFD700"
          />
          
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={[styles.input, styles.disabledInput]}
            value={user?.email || ''}
            editable={false}
          />
          <Text style={styles.infoText}>Email cannot be changed from this screen.</Text>
        </View>

        <TouchableOpacity 
            style={styles.dangerZone}
            onPress={() => Alert.alert("Reset Password", "A reset link has been sent to your email.")}
        >
          <Text style={styles.dangerText}>Change Password</Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingTop: 60, 
    paddingHorizontal: 20, 
    paddingBottom: 20 
  },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', textTransform: 'uppercase' },
  saveText: { color: '#FFD700', fontSize: 16, fontWeight: 'bold' },
  
  scrollContent: { padding: 20, alignItems: 'center' },
  
  avatarContainer: { alignItems: 'center', marginVertical: 30 },
  avatarCircle: { 
    width: 120, 
    height: 120, 
    borderRadius: 60, 
    backgroundColor: '#0a0a0a', 
    borderWidth: 1, 
    borderColor: '#1a1a1a', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  cameraIcon: { 
    position: 'absolute', 
    bottom: 5, 
    right: 5, 
    backgroundColor: '#FFD700', 
    padding: 8, 
    borderRadius: 15 
  },
  changePhotoText: { color: '#FFD700', marginTop: 15, fontSize: 14, fontWeight: '500' },

  inputSection: { width: '100%', marginTop: 20 },
  label: { color: '#444', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 10, letterSpacing: 1 },
  input: { 
    backgroundColor: '#0a0a0a', 
    color: '#fff', 
    padding: 15, 
    borderRadius: 15, 
    fontSize: 16, 
    borderWidth: 1, 
    borderColor: '#1a1a1a',
    marginBottom: 20 
  },
  disabledInput: { color: '#666', opacity: 0.6 },
  infoText: { color: '#333', fontSize: 11, marginTop: -15, marginBottom: 20 },

  dangerZone: { marginTop: 20, padding: 10 },
  dangerText: { color: '#888', textDecorationLine: 'underline' }
});