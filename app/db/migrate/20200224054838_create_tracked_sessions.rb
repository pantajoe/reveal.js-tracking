class CreateTrackedSessions < ActiveRecord::Migration[6.0]
  def change
    create_table :tracked_sessions do |t|
      t.jsonb :tracking_json, null: false, default: {}
      t.references :student

      t.timestamps
    end
  end
end
