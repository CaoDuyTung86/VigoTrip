package com.booking.api.service;

import com.booking.api.dto.ReviewRequest;
import com.booking.api.dto.ReviewResponse;
import com.booking.api.entity.Booking;
import com.booking.api.entity.Review;
import com.booking.api.entity.Trip;
import com.booking.api.entity.User;
import com.booking.api.exception.BookingException;
import com.booking.api.exception.DuplicateResourceException;
import com.booking.api.exception.ResourceNotFoundException;
import com.booking.api.repository.BookingRepository;
import com.booking.api.repository.ReviewRepository;
import com.booking.api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReviewService {

    private final ReviewRepository reviewRepository;
    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;

    @Transactional
    public ReviewResponse submitReview(String email, ReviewRequest request) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy user"));

        Booking booking = bookingRepository.findById(request.getBookingId())
                .orElseThrow(() -> new ResourceNotFoundException("Booking", request.getBookingId()));

        // Kiểm tra quyền sở hữu
        if (!booking.getUser().getId().equals(user.getId())) {
            throw new BookingException("Bạn không có quyền đánh giá booking này");
        }

        // Chỉ cho phép đánh giá booking đã COMPLETED
        if (!"COMPLETED".equals(booking.getStatus())) {
            throw new BookingException("Chỉ có thể đánh giá chuyến đi đã hoàn thành");
        }

        // Lấy trip từ ticket của booking
        Trip trip = null;
        if (booking.getTickets() != null && !booking.getTickets().isEmpty()) {
            trip = booking.getTickets().get(0).getTrip();
        }
        if (trip == null) {
            throw new ResourceNotFoundException("Không tìm thấy thông tin chuyến đi của booking này");
        }

        // Kiểm tra đã đánh giá chưa
        if (reviewRepository.existsByUserIdAndTripId(user.getId(), trip.getId())) {
            throw new DuplicateResourceException("Bạn đã đánh giá chuyến đi này rồi");
        }

        Review review = new Review();
        review.setUser(user);
        review.setTrip(trip);
        review.setBooking(booking);
        review.setRating(request.getRating());
        review.setComment(request.getComment());

        Review saved = reviewRepository.save(review);

        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<ReviewResponse> getReviewsByTrip(Long tripId) {
        return reviewRepository.findByTripId(tripId).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<ReviewResponse> getAllReviews() {
        return reviewRepository.findAll().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    private ReviewResponse toResponse(Review review) {
        Trip t = review.getTrip();
        String pName = (t != null && t.getVehicle() != null && t.getVehicle().getProvider() != null) 
                       ? t.getVehicle().getProvider().getProviderName() : "Unknown";
        String origin = (t != null && t.getRoute() != null) ? t.getRoute().getOrigin() : "";
        String dest = (t != null && t.getRoute() != null) ? t.getRoute().getDestination() : "";

        return ReviewResponse.builder()
                .id(review.getId())
                .rating(review.getRating())
                .comment(review.getComment())
                .userName(review.getUser().getFullName())
                .tripId(t != null ? t.getId() : null)
                .tripOrigin(origin)
                .tripDestination(dest)
                .providerName(pName)
                .build();
    }
}
