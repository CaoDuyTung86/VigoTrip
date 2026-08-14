/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';

const SavedPassengersContext = createContext();

export const useSavedPassengers = () => useContext(SavedPassengersContext);

export const SavedPassengersProvider = ({ children }) => {
    const { token, isAuthenticated } = useAuth();
    const [savedPassengers, setSavedPassengers] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchSavedPassengers = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/saved-passengers', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                const data = await res.json();
                setSavedPassengers(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        if (isAuthenticated && token) {
            fetchSavedPassengers();
        } else {
            const local = localStorage.getItem('guestSavedPassengers');
            if (local) {
                try {
                    setSavedPassengers(JSON.parse(local));
                } catch (error) {
                    console.error("Error parsing guest passengers:", error);
                }
            } else {
                setSavedPassengers([]);
            }
        }
    }, [isAuthenticated, token, fetchSavedPassengers]);

    const addPassenger = useCallback(async (passengerData) => {
        if (isAuthenticated && token) {
            try {
                const res = await fetch('/api/saved-passengers', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(passengerData)
                });
                if (res.ok) {
                    const newP = await res.json();
                    setSavedPassengers(prev => [...prev, newP]);
                    return newP;
                }
            } catch (error) {
                console.error(error);
            }
        } else {
            // Guest -> local storage (only name, email, phone)
            const localP = {
                id: Date.now().toString(),
                fullName: passengerData.fullName || "",
                email: passengerData.email || "",
                phone: passengerData.phone || passengerData.phoneDigits || "",
                passengerType: passengerData.passengerType || 'ADULT',
            };
            // Check if already exists in guest
            setSavedPassengers(prev => {
                let updated = [...prev];
                let existingIdx = updated.findIndex(p => p.fullName === localP.fullName && p.phone === localP.phone);
                if (existingIdx >= 0) {
                   updated[existingIdx] = {...updated[existingIdx], ...localP}; 
                } else {
                   updated.push(localP);
                }
                localStorage.setItem('guestSavedPassengers', JSON.stringify(updated));
                return updated;
            });
            return localP;
        }
    }, [isAuthenticated, token]);

    const removePassenger = useCallback(async (id) => {
        if (isAuthenticated && token) {
            try {
                const res = await fetch(`/api/saved-passengers/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    setSavedPassengers(prev => prev.filter(p => p.id !== id));
                }
            } catch(error) {
                console.error("Failed to remove passenger:", error);
            }
        } else {
            setSavedPassengers(prev => {
                const updated = prev.filter(p => p.id !== id);
                localStorage.setItem('guestSavedPassengers', JSON.stringify(updated));
                return updated;
            });
        }
    }, [isAuthenticated, token]);

    const value = useMemo(() => ({
        savedPassengers,
        loading,
        addPassenger,
        removePassenger
    }), [savedPassengers, loading, addPassenger, removePassenger]);

    return (
        <SavedPassengersContext.Provider value={value}>
            {children}
        </SavedPassengersContext.Provider>
    );
};
