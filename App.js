import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

// Import your screens (Ensure the file paths are correct for your project)
import HomeScreen from './screens/HomeScreen';
import ProductDetailScreen from './screens/ProductDetailScreen';

const Stack = createStackNavigator();

// --- Support Chat Screen Component ---
function SupportScreen() {
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState([
    { id: '1', text: 'Welcome to Ferfume! How can we help?', sender: 'support' }
  ]);

  const sendMessage = () => {
    if (inputText.trim().length > 0) {
      const newMessage = {
        id: Date.now().toString(),
        text: inputText,
        sender: 'user',
      };
      setMessages([...messages, newMessage]);
      setInputText('');
    }
  };

  const renderItem = ({ item }) => (
    <View style={[
      styles.bubble, 
      item.sender === 'user' ? styles.userBubble : styles.supportBubble
    ]}>
      <Text style={styles.messageText}>{item.text}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 20}
      >
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type your message..."
            placeholderTextColor="#888"
          />
          <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// --- Main App Entry Point ---
export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="Home"
        screenOptions={{
          headerStyle: { backgroundColor: '#121212', borderBottomColor: '#333' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      >
        {/* The Home Screen you built earlier */}
        <Stack.Screen 
          name="Home" 
          component={HomeScreen} 
          options={{ headerShown: false }} // We keep it hidden because we built a custom header
        />

        {/* The Product Detail Screen we just created */}
        <Stack.Screen 
          name="ProductDetail" 
          component={ProductDetailScreen} 
          options={{ title: 'Product Details', headerTransparent: true, headerTitle: '' }}
        />

        {/* Your Support Chat Screen */}
        <Stack.Screen 
          name="Support" 
          component={SupportScreen} 
          options={{ title: 'Ferfume Support' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  listContent: { padding: 20 },
  bubble: { padding: 12, borderRadius: 18, marginBottom: 10, maxWidth: '80%' },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#fff' }, // Changed to white for a cleaner look
  supportBubble: { alignSelf: 'flex-start', backgroundColor: '#333' },
  messageText: { color: item => item.sender === 'user' ? '#000' : '#fff', fontSize: 16 },
  inputContainer: { flexDirection: 'row', padding: 15, backgroundColor: '#1f1f1f' },
  input: { flex: 1, backgroundColor: '#2c2c2e', color: '#fff', borderRadius: 20, paddingHorizontal: 15, height: 40 },
  sendButton: { marginLeft: 10, justifyContent: 'center', backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 15 },
  sendButtonText: { color: '#000', fontWeight: 'bold' }
});