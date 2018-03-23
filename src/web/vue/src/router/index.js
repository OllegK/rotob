import Vue from 'vue'
import Router from 'vue-router'
import Status from '@/components/Status'
import Config from '@/components/Config'
import State from '@/components/State'
import Symbols from '@/components/Symbols'

Vue.use(Router)

export default new Router({
  routes: [
    {
      path: '/',
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
    }
  ]
})
