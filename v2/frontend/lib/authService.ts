import axios from 'axios';

const API_URL = 'http://127.0.0.1:8000/api';

export const authService = {
  // register user
    register: async (userData: any) => {
        try {
            const response = await axios.post(`${API_URL}/register`, userData);
              if (response.data.access_token) {
                localStorage.setItem('cvmaster_user', JSON.stringify(response.data.user));
                localStorage.setItem('token', response.data.access_token);
            }
            return response.data;
        } catch (error: any) {
            throw error.response?.data || error.message;
        }
    },
    // login user

    login: async (credentials: any) => {
        try {
            const response = await axios.post(`${API_URL}/login`, credentials);
            if (response.data.access_token) {
                localStorage.setItem('cvmaster_user', JSON.stringify(response.data.user));
                localStorage.setItem('token', response.data.access_token);
            }
            return response.data;
        } catch (error: any) {
            throw error.response?.data || error.message;
        }
    },
    // logout user

    logout: () => {
    localStorage.removeItem("cvmaster_user")
    localStorage.removeItem("token")
    localStorage.removeItem("cvmaster_profile")
    },
    // get user profile
     getProfile: async () => {
    try {
      const token = localStorage.getItem("token")

      if (!token) {
        throw new Error("No authentication token found.")
      }

      const response = await axios.get(`${API_URL}/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      })

      // حفظ البيانات في localStorage (اختياري)
    //   localStorage.setItem("cvmaster_profile", JSON.stringify(response.data.profile))

      return response.data.profile
    } catch (error: any) {
      throw error.response?.data || error.message
    }
  },
  // update user profile
 updateProfile: async (profileData: any) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("No authentication token found.");
      }

      // Laravel يحتاج _method=PUT لو endpoint بيقبل PUT فقط
      const payload = { ...profileData, _method: "PUT" };

      const response = await axios.post(`${API_URL}/profile`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      localStorage.setItem("cvmaster_profile", JSON.stringify(response.data.profile));
      return response.data.profile;
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        console.error("Error updating profile:", error.response?.data);
        throw error.response?.data || error.message;
      } else {
        console.error("Unexpected error:", error);
        throw error;
      }
    }
  },

};