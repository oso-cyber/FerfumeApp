import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
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
    View
} from 'react-native';
import { auth, db } from '../firebaseConfig';

export default function RegisterScreen() {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    // Ported Logic: validateInput from Kotlin
    const validateInput = () => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!fullName.trim()) {
            Alert.alert("Input Error", "Please enter your full name");
            return false;
        }
        if (!email.trim()) {
            Alert.alert("Input Error", "Please enter your email");
            return false;
        }
        if (!emailRegex.test(email.trim())) {
            Alert.alert("Input Error", "Please enter a valid email");
            return false;
        }
        if (!password) {
            Alert.alert("Input Error", "Please enter your password");
            return false;
        }
        if (password.length < 6) {
            Alert.alert("Input Error", "Password should be at least 6 characters");
            return false;
        }
        if (password !== confirmPassword) {
            Alert.alert("Input Error", "Passwords do not match");
            return false;
        }
        return true;
    };

    // Ported Logic: registerUser from Kotlin
    const handleSignUp = async () => {
        if (!validateInput()) return;

        setLoading(true);

        try {
            // 1. Create user in Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
            const userId = userCredential.user.uid;

            // 2. Create userMap and save to Firestore (Matching your Kotlin logic)
            const userMap = {
                fullName: fullName.trim(),
                email: email.trim(),
                createdAt: Date.now() // Optional: good for sorting
            };

            await setDoc(doc(db, "users", userId), userMap);

            setLoading(false);
            Alert.alert("Success", "Registration successful");
            
            // Navigate back to LoginScreen as per your Kotlin Intent logic
            router.replace('/LoginScreen');

        } catch (error: any) {
            setLoading(false);
            Alert.alert("Registration failed", error.message);
        }
    };

    return (
        <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
            style={styles.container}
        >
            <ScrollView contentContainerStyle={styles.scrollInner} showsVerticalScrollIndicator={false}>
                <Text style={styles.title}>Register</Text>
                <Text style={styles.subtitle}>Create your account to start shopping</Text>

                <View style={styles.inputContainer}>
                    {/* Full Name - Ported from input_name */}
                    <TextInput
                        style={styles.input}
                        placeholder="Full Name"
                        placeholderTextColor="#444"
                        value={fullName}
                        onChangeText={setFullName}
                    />

                    {/* Email - Ported from input_email */}
                    <TextInput
                        style={styles.input}
                        placeholder="Email"
                        placeholderTextColor="#444"
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                    />

                    {/* Password - Ported from input_password */}
                    <TextInput
                        style={styles.input}
                        placeholder="Password"
                        placeholderTextColor="#444"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />

                    {/* Confirm Password - Ported from input_confirm_password */}
                    <TextInput
                        style={styles.input}
                        placeholder="Confirm Password"
                        placeholderTextColor="#444"
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry
                    />
                </View>

                {/* Sign Up Button - Ported from btn_signup */}
                <TouchableOpacity 
                    style={styles.signUpButton} 
                    onPress={handleSignUp}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#000" />
                    ) : (
                        <Text style={styles.buttonText}>Sign Up</Text>
                    )}
                </TouchableOpacity>

                {/* Already have account - Ported from tv_already_account */}
                <TouchableOpacity onPress={() => router.replace('/LoginScreen')}>
                    <Text style={styles.footerText}>
                        Already have an account? <Text style={styles.link}>Login</Text>
                    </Text>
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    scrollInner: { flexGrow: 1, justifyContent: 'center', padding: 25 },
    title: { color: '#fff', fontSize: 34, fontWeight: 'bold', marginBottom: 5 },
    subtitle: { color: '#666', fontSize: 14, marginBottom: 35 },
    inputContainer: { width: '100%' },
    input: {
        backgroundColor: '#0a0a0a',
        color: '#fff',
        padding: 18,
        borderRadius: 15,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#1a1a1a'
    },
    signUpButton: {
        backgroundColor: '#fff',
        padding: 18,
        borderRadius: 15,
        alignItems: 'center',
        marginTop: 20,
        shadowColor: '#fff',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.1,
        shadowRadius: 10
    },
    buttonText: { color: '#000', fontWeight: 'bold', fontSize: 16, textTransform: 'uppercase' },
    footerText: { color: '#666', textAlign: 'center', marginTop: 30, fontSize: 14 },
    link: { color: '#fff', fontWeight: 'bold' }
});