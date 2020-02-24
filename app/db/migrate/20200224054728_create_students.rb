class CreateStudents < ActiveRecord::Migration[6.0]
  def change
    create_table :students do |t|
      t.string :user_token

      t.timestamps
    end
  end
end
