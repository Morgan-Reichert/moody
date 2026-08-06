//
//  MoodyWidgetLiveActivity.swift
//  MoodyWidget
//
//  Created by Morgan Reichert on 06/08/2026.
//

import ActivityKit
import WidgetKit
import SwiftUI

struct MoodyWidgetAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        // Dynamic stateful properties about your activity go here!
        var emoji: String
    }

    // Fixed non-changing properties about your activity go here!
    var name: String
}

struct MoodyWidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: MoodyWidgetAttributes.self) { context in
            // Lock screen/banner UI goes here
            VStack {
                Text("Hello \(context.state.emoji)")
            }
            .activityBackgroundTint(Color.cyan)
            .activitySystemActionForegroundColor(Color.black)

        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded UI goes here.  Compose the expanded UI through
                // various regions, like leading/trailing/center/bottom
                DynamicIslandExpandedRegion(.leading) {
                    Text("Leading")
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text("Trailing")
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text("Bottom \(context.state.emoji)")
                    // more content
                }
            } compactLeading: {
                Text("L")
            } compactTrailing: {
                Text("T \(context.state.emoji)")
            } minimal: {
                Text(context.state.emoji)
            }
            .widgetURL(URL(string: "http://www.apple.com"))
            .keylineTint(Color.red)
        }
    }
}

extension MoodyWidgetAttributes {
    fileprivate static var preview: MoodyWidgetAttributes {
        MoodyWidgetAttributes(name: "World")
    }
}

extension MoodyWidgetAttributes.ContentState {
    fileprivate static var smiley: MoodyWidgetAttributes.ContentState {
        MoodyWidgetAttributes.ContentState(emoji: "😀")
     }
     
     fileprivate static var starEyes: MoodyWidgetAttributes.ContentState {
         MoodyWidgetAttributes.ContentState(emoji: "🤩")
     }
}

#Preview("Notification", as: .content, using: MoodyWidgetAttributes.preview) {
   MoodyWidgetLiveActivity()
} contentStates: {
    MoodyWidgetAttributes.ContentState.smiley
    MoodyWidgetAttributes.ContentState.starEyes
}
