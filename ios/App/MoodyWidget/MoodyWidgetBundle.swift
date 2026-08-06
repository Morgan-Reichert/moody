//
//  MoodyWidgetBundle.swift
//  MoodyWidget
//
//  Created by Morgan Reichert on 06/08/2026.
//

import WidgetKit
import SwiftUI

struct MoodyWidgetBundle: WidgetBundle {
    var body: some Widget {
        MoodyWidget()
        MoodyWidgetControl()
        MoodyWidgetLiveActivity()
    }
}
