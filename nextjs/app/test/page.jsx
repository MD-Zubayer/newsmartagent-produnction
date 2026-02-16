'use client'

import { useState } from "react"

export default function UserForm() {

    const [user, setUser] = useState({
        name: '', 
        email: '',
        age: 0,
        isSubscribed: false,
        address: {
            city:'',
            country: 'bangladesh'
        }
    });

    const handleChange = (e) => {
        const {name, value, type, checked} = e.target;

        setUser(prevUser => ({
            ...prevUser,
            [name]: type === 'checkbox' ? checked : value
        }));
    }

    const updateAddress = (field, value) => {
        setUser(prevUser => ({
            ...prevUser,
            address: {
                ...prevUser.address,
                [field]: value
            }
        }));
    };

    return (
        <form action="" >
<input type="text" name="name" value={user.name} onChange={handleChange} placeholder='name' />

        </form>
        
         
    )




}