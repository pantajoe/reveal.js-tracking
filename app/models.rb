class Student < ActiveRecord::Base
  has_many :tracked_sessions, inverse_of: :student, dependent: :nullify
end

class TrackedSession < ActiveRecord::Base
  belongs_to :student, inverse_of: :tracked_sessions
end
