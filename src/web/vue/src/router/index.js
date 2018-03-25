import Vue from 'vue'
import Router from 'vue-router'
import Status from '@/components/Status'
import Config from '@/components/Config'
import State from '@/components/State'
import Symbols from '@/components/Symbols'
import Signin from '@/components/Signin'
import * as auth from '@/shared/auth'

Vue.use(Router)

const router = new Router({
  routes: [
    {
      path: '/login',
      name: 'Signin',
      component: Signin
    },
    {
      path: '/status',
      name: 'Status',
      component: Status
    },
    {
      path: '/config',
      name: 'Config',
      component: Config
    },
    {
      path: '/state',
      name: 'State',
      component: State
    },
    {
      path: '/symbols',
      name: 'Symbols',
      component: Symbols
    },
    {
      path: '*',
      redirect: '/state'
    }
  ]
})

router.beforeEach((to, from, next) => {
  if (to.path !== '/login') {
    if (auth.default.user.authenticated) {
      next()
    } else {
      router.push('/login')
    }
  } else {
    next()
  }
})

export default router
