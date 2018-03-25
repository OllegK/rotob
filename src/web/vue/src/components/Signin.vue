<template>
  <v-container fluid fill-height>
      <v-layout align-center justify-center>
        <v-flex>

          <v-toolbar dark color="secondary">
            <v-toolbar-title>Robot Login</v-toolbar-title>
          </v-toolbar>
          <form @submit.prevent="onSignIn" @keyup.prevent.enter="onSignIn">
          <v-card>
            <v-card-text>

                <v-layout>
                  <v-flex>
                    <v-text-field
                      name="username"
                      prepend-icon="person"
                      label="Username"
                      id="username"
                      v-model="username"
                      type="text"
                      required
                      ></v-text-field>
                  </v-flex>
                </v-layout>

                <v-layout>
                  <v-flex>
                    <v-text-field
                      name="password"
                      prepend-icon="lock"
                      label="Password"
                      id="password"
                      v-model="password"
                      type="password"
                      required
                      ></v-text-field>
                  </v-flex>
                </v-layout>
            </v-card-text>
            <v-card-actions>
              <v-spacer></v-spacer>
              <v-btn
                type="submit"
                class="accent"
                @click="loader = 'loading'">Sign In
                <span slot="loader" class="custom-loader">
                  <v-icon light>cached</v-icon>
                </span>
              </v-btn>
            </v-card-actions>
          </v-card>
          </form>
        </v-flex>
      </v-layout>
  </v-container>
</template>

<script>
import * as auth from '@/shared/auth'

export default {
  data () {
    return {
      username: '',
      password: ''
    }
  },

  computed: {
    user () {
      return this.$store.getters.user
    },
    error () {
      return this.$store.getters.error
    },
    loading () {
      return this.$store.getters.loading
    }
  },

  methods: {
    async onSignIn () {
      const signInData = {
        username: this.username,
        password: this.password
      }
      console.log(signInData)
      console.log(auth);
      // check database - make salt
      await auth.default.authenticate(signInData);
      this.$router.push('/status')
    },
    onDismissed () {
      this.$store.dispatch('clearError')
    }
  },
  beforeUpdate () {}
}
</script>
