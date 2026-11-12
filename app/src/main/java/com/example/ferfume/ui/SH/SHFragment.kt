package com.example.ferfume.ui.SH

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import com.example.ferfume.R
import com.example.ferfume.ui.SH.SHViewModel

class SHFragment : Fragment() {

    companion object {
        fun newInstance() = SHFragment()
    }

    private val viewModel: SHViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // TODO: Use the ViewModel
    }

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        return inflater.inflate(R.layout.fragment_s_h, container, false)
    }
}