package com.example.ferfume

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.ferfume.databinding.ActivityManageUsersBinding
import com.google.firebase.firestore.FirebaseFirestore

class ManageUsers : AppCompatActivity() {

    private lateinit var binding: ActivityManageUsersBinding
    private lateinit var adapter: UsersAdapter
    private val userList = mutableListOf<User>()
    private val db = FirebaseFirestore.getInstance()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityManageUsersBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Setup RecyclerView
        binding.recyclerUsers.layoutManager = LinearLayoutManager(this)
        adapter = UsersAdapter(userList, db)
        binding.recyclerUsers.adapter = adapter

        // Fetch users from Firestore
        fetchUsers()
    }

    private fun fetchUsers() {
        db.collection("users")
            .get()
            .addOnSuccessListener { result ->
                userList.clear()
                for (document in result) {
                    val user = User(
                        id = document.id,
                        username = document.getString("username") ?: "",
                        email = document.getString("email") ?: ""
                    )
                    userList.add(user)
                }
                adapter.notifyDataSetChanged()
            }
            .addOnFailureListener {
                Toast.makeText(this, "Failed to load users", Toast.LENGTH_SHORT).show()
            }
    }
}

data class User(
    val id: String = "",
    val username: String = "",
    val email: String = ""
)

class UsersAdapter(
    private val users: MutableList<User>,
    private val db: FirebaseFirestore
) : RecyclerView.Adapter<UsersAdapter.UserViewHolder>() {

    class UserViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val tvUsername: TextView = itemView.findViewById(R.id.tvUsername)
        val tvEmail: TextView = itemView.findViewById(R.id.tvEmail)
        val tvId: TextView = itemView.findViewById(R.id.tvId)
        val btnDelete: Button = itemView.findViewById(R.id.btnDeleteUser)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): UserViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_user, parent, false)
        return UserViewHolder(view)
    }

    override fun onBindViewHolder(holder: UserViewHolder, position: Int) {
        val user = users[position]
        holder.tvUsername.text = "👤 ${user.username}"
        holder.tvEmail.text = "📧 ${user.email}"
        holder.tvId.text = "🆔 ${user.id}"

        // Delete button
        holder.btnDelete.setOnClickListener {
            db.collection("users").document(user.id)
                .delete()
                .addOnSuccessListener {
                    Toast.makeText(holder.itemView.context, "User deleted", Toast.LENGTH_SHORT).show()
                    users.removeAt(position)
                    notifyItemRemoved(position)
                }
                .addOnFailureListener {
                    Toast.makeText(holder.itemView.context, "Failed to delete user", Toast.LENGTH_SHORT).show()
                }
        }

        // 👉 Handle click on entire card to open orders
        holder.itemView.setOnClickListener {
            val context = holder.itemView.context
            val intent = android.content.Intent(context, UserOrders::class.java)
            intent.putExtra("userId", user.id)
            intent.putExtra("username", user.username)
            intent.putExtra("email", user.email)
            context.startActivity(intent)
        }
    }


    override fun getItemCount(): Int = users.size
}
