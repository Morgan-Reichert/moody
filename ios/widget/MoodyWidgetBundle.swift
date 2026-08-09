// MoodyWidgetBundle.swift — the single @main entry point for the widget extension.
// Xcode generates a file like this automatically; REPLACE its contents with this.
// It must be the ONLY @main in the widget target.

import WidgetKit
import SwiftUI

@main
struct MoodyWidgetBundle: WidgetBundle {
    var body: some Widget {
        MoodyCheckinWidget()   // Comment vas-tu ?
        MoodyMedsWidget()      // Médicaments
        MoodyMoodWidget()      // Humeur
        MoodyTodayWidget()     // Aujourd'hui
        MoodyTipWidget()       // Conseil
        if #available(iOS 16.0, *) { MoodyLockWidget() }  // écran verrouillé
    }
}
