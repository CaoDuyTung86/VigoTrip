package com.booking.api.service;

import com.booking.api.dto.SavedPassengerDTO;
import com.booking.api.entity.SavedPassenger;
import com.booking.api.entity.User;
import com.booking.api.exception.ResourceNotFoundException;
import com.booking.api.repository.SavedPassengerRepository;
import com.booking.api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SavedPassengerService {

    private final SavedPassengerRepository savedPassengerRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<SavedPassengerDTO> getByUser(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return savedPassengerRepository.findByUserId(user.getId())
                .stream().map(this::toDTO).toList();
    }

    @Transactional
    public SavedPassengerDTO create(String email, SavedPassengerDTO dto) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        SavedPassenger sp = new SavedPassenger();
        sp.setUser(user);
        sp.setFullName(dto.getFullName());
        sp.setEmail(dto.getEmail());
        sp.setPhone(dto.getPhone());
        sp.setDateOfBirth(dto.getDateOfBirth());
        sp.setGender(dto.getGender());
        sp.setIdNumber(dto.getIdNumber());
        sp.setNationality(dto.getNationality());
        sp.setPassengerType(dto.getPassengerType());
        savedPassengerRepository.save(sp);
        return toDTO(sp);
    }

    @Transactional
    public SavedPassengerDTO update(String email, Long id, SavedPassengerDTO dto) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        SavedPassenger sp = savedPassengerRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("SavedPassenger not found"));
        if (!sp.getUser().getId().equals(user.getId())) {
            throw new IllegalArgumentException("Not authorized");
        }
        if (dto.getFullName() != null) sp.setFullName(dto.getFullName());
        if (dto.getEmail() != null) sp.setEmail(dto.getEmail());
        if (dto.getPhone() != null) sp.setPhone(dto.getPhone());
        if (dto.getDateOfBirth() != null) sp.setDateOfBirth(dto.getDateOfBirth());
        if (dto.getGender() != null) sp.setGender(dto.getGender());
        if (dto.getIdNumber() != null) sp.setIdNumber(dto.getIdNumber());
        if (dto.getNationality() != null) sp.setNationality(dto.getNationality());
        if (dto.getPassengerType() != null) sp.setPassengerType(dto.getPassengerType());
        savedPassengerRepository.save(sp);
        return toDTO(sp);
    }

    @Transactional
    public void delete(String email, Long id) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        SavedPassenger sp = savedPassengerRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("SavedPassenger not found"));
        if (!sp.getUser().getId().equals(user.getId())) {
            throw new IllegalArgumentException("Not authorized");
        }
        savedPassengerRepository.delete(sp);
    }

    private SavedPassengerDTO toDTO(SavedPassenger sp) {
        return SavedPassengerDTO.builder()
                .id(sp.getId())
                .fullName(sp.getFullName())
                .email(sp.getEmail())
                .phone(sp.getPhone())
                .dateOfBirth(sp.getDateOfBirth())
                .gender(sp.getGender())
                .idNumber(sp.getIdNumber())
                .nationality(sp.getNationality())
                .passengerType(sp.getPassengerType())
                .build();
    }
}
