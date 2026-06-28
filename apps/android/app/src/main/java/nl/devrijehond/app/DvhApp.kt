package nl.devrijehond.app

import android.app.Application

class DvhApp : Application() {
    override fun onCreate() {
        super.onCreate()
        AppGraph.init(this)
    }
}
