import axios from 'axios'

export default {
  user: {
    authenticated: false
  },
  authenticate: async function () {
    console.log('`````````````````````````````')
    let response = await axios.get('/api/login')
    console.log(response.data)
    localStorage.setItem('id_token', response.data.id_token)
    localStorage.setItem('access_token', response.data.access_token)
    console.log(response.data.id_token);
    console.log(response.data.access_token);
    console.log(this);
    console.log(this.user);
    this.user.authenticated = true
  },
  logout: async function () {
    localStorage.removeItem('id_token')
    localStorage.removeItem('access_token')
    this.user.authenticated = false
  },

}
