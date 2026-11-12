import { useRouter } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { auth, db } from '../firebaseConfig';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async () => {
        // 1. Basic Validation
        if (!email || !password) {
            Alert.alert("Error", "Please fill in all fields");
            return;
        }

        setLoading(true);

        try {
            // 2. Admin Bypass Logic
            if (email === "admin@ferfume.com" && password === "CONFIGURE_ADMIN_PASSWORD") {
                setLoading(false);
                // Navigate to Admin
                return;
            }

            // 3. Firebase Auth Login
            const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
            const user = userCredential.user;

            // 4. Ensure User Document & Cart Structure exists
            await checkOrCreateUserRecord(user.uid, user.email);

            setLoading(false);
            // Redirection is handled automatically by RootLayout via onAuthStateChanged

        } catch (error: any) {
            setLoading(false);
            let errorMessage = "An error occurred during sign in.";
            
            if (error.code === 'auth/user-not-found') errorMessage = "No account found with this email.";
            if (error.code === 'auth/wrong-password') errorMessage = "Incorrect password.";
            
            Alert.alert("Login Failed", errorMessage);
        }
    };

    const checkOrCreateUserRecord = async (uid: string, userEmail: string | null) => {
        const userRef = doc(db, "users", uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            // First time login - Create their profile
            await setDoc(userRef, {
                uid: uid,
                email: userEmail,
                createdAt: Date.now(),
                role: 'user'
            });
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <View style={styles.inner}>
                <Text style={styles.logo}>EXQUISITE DELUXE CAKES</Text>
                <Text style={styles.subtitle}>cakes & Treats</Text>

                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder="Email"
                        placeholderTextColor="#555"
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Password"
                        placeholderTextColor="#555"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />
                </View>

                <TouchableOpacity
                    style={styles.loginButton}
                    onPress={handleLogin}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#000" />
                    ) : (
                        <Text style={styles.buttonText}>Login</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => router.push('/RegisterScreen' as any)}>
                    <Text style={styles.footerText}>
                        Don't have an account? <Text style={styles.link}>Sign Up</Text>
                    </Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    inner: { flex: 1, justifyContent: 'center', padding: 30 },
    logo: {
        color: '#fff',
        fontSize: 32,
        fontWeight: 'bold',
        textAlign: 'center',
        letterSpacing: 4
    },
    subtitle: {
        color: '#444',
        textAlign: 'center',
        marginBottom: 50,
        textTransform: 'uppercase',
        fontSize: 12,
        letterSpacing: 2
    },
    inputContainer: { marginBottom: 20 },
    input: {
        backgroundColor: '#111',
        color: '#fff',
        padding: 18,
        borderRadius: 15,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#222'
    },
    loginButton: {
        backgroundColor: '#fff',
        padding: 18,
        borderRadius: 15,
        alignItems: 'center',
        marginTop: 10
    },
    buttonText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
    footerText: { color: '#666', textAlign: 'center', marginTop: 25 },
    link: { color: '#fff', fontWeight: 'bold' }
});